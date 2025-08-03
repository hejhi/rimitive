import { CONSTANTS } from '../constants';
import type { ConsumerNode, ProducerNode, Edge } from '../types';
import type { SignalContext } from '../context';

const { RUNNING, OUTDATED, NOTIFIED } = CONSTANTS;

// Interface for nodes that can be updated iteratively
interface UpdatableNode extends ConsumerNode, ProducerNode {
  _flags: number;
  _globalVersion?: number;
  _callback?: () => any;
  _value?: any;
  _version: number;
}

// Stack frame for iterative traversal
interface UpdateFrame {
  node: UpdatableNode | null;
  phase: number; // Using numbers instead of strings for performance
  currentSource: Edge | undefined;
  isDirty: boolean;
  sourceNode: UpdatableNode | undefined;
  sourceOldVersion: number | undefined;
}

// Phase constants as numbers (faster than string comparisons)
const PHASE_CHECK_DIRTY = 0;
const PHASE_TRAVERSE_SOURCES = 1;
const PHASE_WAIT_FOR_SOURCE = 2;
const PHASE_READY_TO_COMPUTE = 3;
const PHASE_COMPUTED = 4;

// Pre-allocated frame pool to reduce allocations
const FRAME_POOL_SIZE = 100;
const framePool: UpdateFrame[] = [];
let framePoolIndex = 0;

// Initialize frame pool
for (let i = 0; i < FRAME_POOL_SIZE; i++) {
  framePool[i] = {
    node: null,
    phase: 0,
    currentSource: undefined,
    isDirty: false,
    sourceNode: undefined,
    sourceOldVersion: undefined
  };
}

// Dynamic stack that grows as needed
let stack: UpdateFrame[] = [];

// Dynamic visiting set that grows as needed
let visiting: UpdatableNode[] = [];

// Helper to get a frame from the pool
function getFrame(): UpdateFrame {
  if (framePoolIndex < framePool.length) {
    return framePool[framePoolIndex++]!;
  }
  // Fallback: create new frame if pool exhausted
  return {
    node: null,
    phase: 0,
    currentSource: undefined,
    isDirty: false,
    sourceNode: undefined,
    sourceOldVersion: undefined
  };
}

// Helper to return frame to pool
function returnFrame(frame: UpdateFrame | undefined): void {
  if (!frame) return;
  
  // Reset frame
  frame.node = null;
  frame.phase = 0;
  frame.currentSource = undefined;
  frame.isDirty = false;
  frame.sourceNode = undefined;
  frame.sourceOldVersion = undefined;
  
  // Return to pool if there's space
  if (framePoolIndex > 0) {
    framePoolIndex--;
    framePool[framePoolIndex] = frame;
  }
}

// Helper to check if node is visiting
function isVisiting(node: UpdatableNode): boolean {
  const len = visiting.length;
  for (let i = 0; i < len; i++) {
    if (visiting[i] === node) return true;
  }
  return false;
}

// Helper to add to visiting
function addVisiting(node: UpdatableNode): void {
  visiting.push(node);
}

// Helper to remove from visiting
function removeVisiting(node: UpdatableNode): void {
  const len = visiting.length;
  for (let i = 0; i < len; i++) {
    if (visiting[i] === node) {
      // Swap with last and remove
      visiting[i] = visiting[len - 1]!;
      visiting.pop();
      return;
    }
  }
}

/**
 * Iteratively update a computed node and all its dependencies.
 * Uses object pooling and pre-allocated data structures to minimize allocations.
 */
export function iterativeUpdate(node: UpdatableNode, ctx: SignalContext): void {
  // Fast path: already up to date
  if (!(node._flags & (OUTDATED | NOTIFIED))) return;
  
  // Reset state
  stack.length = 0;
  visiting.length = 0;
  framePoolIndex = 0;
  
  // Push initial node
  const initialFrame = getFrame();
  initialFrame.node = node;
  initialFrame.phase = PHASE_CHECK_DIRTY;
  initialFrame.isDirty = false;
  stack.push(initialFrame);
  
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!; // Top of stack
    
    switch (frame.phase) {
      case PHASE_CHECK_DIRTY: {
        // Check if node needs update
        if (frame.node!._flags & OUTDATED) {
          frame.isDirty = true;
          frame.phase = PHASE_TRAVERSE_SOURCES;
        } else if (frame.node!._flags & NOTIFIED) {
          // Need to check sources
          frame.phase = PHASE_TRAVERSE_SOURCES;
          frame.currentSource = frame.node!._sources;
        } else {
          // Node is clean
          returnFrame(stack.pop());
        }
        break;
      }
      
      case PHASE_TRAVERSE_SOURCES: {
        // Check all sources for changes
        
        while (frame.currentSource) {
          const source = frame.currentSource;
          const sourceNode = source.source;
          
          // Check if source is a computed that needs updating
          if ('_flags' in sourceNode && '_callback' in sourceNode) {
            const updatableSource = sourceNode as UpdatableNode;
            
            if (updatableSource._flags & (OUTDATED | NOTIFIED)) {
              // Need to update this source first
              if (isVisiting(updatableSource)) {
                throw new Error('Cycle detected');
              }
              
              // Save state and process source
              frame.sourceNode = updatableSource;
              frame.sourceOldVersion = updatableSource._version;
              frame.phase = PHASE_WAIT_FOR_SOURCE;
              
              // Push source onto stack
              const sourceFrame = getFrame();
              sourceFrame.node = updatableSource;
              sourceFrame.phase = PHASE_CHECK_DIRTY;
              sourceFrame.isDirty = false;
              stack.push(sourceFrame);
              addVisiting(updatableSource);
              break;
            }
          }
          
          // Check if source version changed
          if (source.version !== sourceNode._version) {
            frame.isDirty = true;
          }
          
          // Update edge version
          source.version = sourceNode._version;
          frame.currentSource = source.nextSource;
        }
        
        // If we processed all sources, move to next phase
        if (!frame.currentSource) {
          if (frame.isDirty) {
            frame.phase = PHASE_READY_TO_COMPUTE;
          } else {
            // Update global version and we're done
            frame.node!._globalVersion = ctx.version;
            frame.node!._flags &= ~NOTIFIED;
            returnFrame(stack.pop());
            removeVisiting(frame.node!);
          }
        }
        break;
      }
      
      case PHASE_WAIT_FOR_SOURCE: {
        // Source has been updated, check if it changed
        if (frame.sourceNode && frame.sourceOldVersion !== undefined) {
          if (frame.sourceOldVersion !== frame.sourceNode._version) {
            frame.isDirty = true;
          }
        }
        
        // Continue traversing sources
        frame.phase = PHASE_TRAVERSE_SOURCES;
        break;
      }
      
      case PHASE_READY_TO_COMPUTE: {
        // All sources are up to date, now compute if needed
        if (frame.node!._callback && frame.isDirty) {
          // Mark as running to detect cycles
          frame.node!._flags |= RUNNING;
          
          try {
            const oldValue = frame.node!._value;
            const newValue = frame.node!._callback();
            
            if (newValue !== oldValue || frame.node!._version === 0) {
              frame.node!._value = newValue;
              frame.node!._version++;
            }
            
            frame.node!._globalVersion = ctx.version;
            frame.node!._flags = (frame.node!._flags & ~(OUTDATED | NOTIFIED | RUNNING));
          } finally {
            frame.node!._flags &= ~RUNNING;
          }
        }
        
        frame.phase = PHASE_COMPUTED;
        break;
      }
      
      case PHASE_COMPUTED: {
        // Node has been computed, pop from stack
        returnFrame(stack.pop());
        removeVisiting(frame.node!);
        break;
      }
    }
  }
}