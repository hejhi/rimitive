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
  node: UpdatableNode;
  phase: 'check-dirty' | 'traverse-sources' | 'wait-for-source' | 'ready-to-compute' | 'computed';
  currentSource?: Edge;
  isDirty: boolean;
  sourceNode?: UpdatableNode;
  sourceOldVersion?: number;
}

/**
 * Iteratively update a computed node and all its dependencies.
 * This is a proof of concept that shows how to eliminate recursion.
 */
export function iterativeUpdate(node: UpdatableNode, ctx: SignalContext): void {
  // Fast path: already up to date
  if (!(node._flags & (OUTDATED | NOTIFIED))) return;
  
  const stack: UpdateFrame[] = [];
  const visiting = new Set<UpdatableNode>();
  
  // Push initial node
  stack.push({
    node,
    phase: 'check-dirty',
    isDirty: false
  });
  
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    
    switch (frame.phase) {
      case 'check-dirty': {
        // Check if node needs update
        if (frame.node._flags & OUTDATED) {
          frame.isDirty = true;
          frame.phase = 'traverse-sources';
        } else if (frame.node._flags & NOTIFIED) {
          // Need to check sources
          frame.phase = 'traverse-sources';
          frame.currentSource = frame.node._sources;
        } else {
          // Node is clean
          stack.pop();
        }
        break;
      }
      
      case 'traverse-sources': {
        // Check all sources for changes
        let allSourcesClean = true;
        
        while (frame.currentSource) {
          const source = frame.currentSource;
          const sourceNode = source.source;
          
          // Check if source is a computed that needs updating
          if ('_flags' in sourceNode && '_callback' in sourceNode) {
            const updatableSource = sourceNode as UpdatableNode;
            
            if (updatableSource._flags & (OUTDATED | NOTIFIED)) {
              // Need to update this source first
              if (visiting.has(updatableSource)) {
                throw new Error('Cycle detected');
              }
              
              // Save state and process source
              frame.sourceNode = updatableSource;
              frame.sourceOldVersion = updatableSource._version;
              frame.phase = 'wait-for-source';
              
              // Push source onto stack
              stack.push({
                node: updatableSource,
                phase: 'check-dirty',
                isDirty: false
              });
              visiting.add(updatableSource);
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
            frame.phase = 'ready-to-compute';
          } else {
            // Update global version and we're done
            frame.node._globalVersion = ctx.version;
            frame.node._flags &= ~NOTIFIED;
            stack.pop();
            visiting.delete(frame.node);
          }
        }
        break;
      }
      
      case 'wait-for-source': {
        // Source has been updated, check if it changed
        if (frame.sourceNode && frame.sourceOldVersion !== undefined) {
          if (frame.sourceOldVersion !== frame.sourceNode._version) {
            frame.isDirty = true;
          }
        }
        
        // Continue traversing sources
        frame.phase = 'traverse-sources';
        break;
      }
      
      case 'ready-to-compute': {
        // All sources are up to date, now compute if needed
        if (frame.node._callback && frame.isDirty) {
          // Mark as running to detect cycles
          frame.node._flags |= RUNNING;
          
          try {
            const oldValue = frame.node._value;
            const newValue = frame.node._callback();
            
            if (newValue !== oldValue || frame.node._version === 0) {
              frame.node._value = newValue;
              frame.node._version++;
            }
            
            frame.node._globalVersion = ctx.version;
            frame.node._flags = (frame.node._flags & ~(OUTDATED | NOTIFIED | RUNNING));
          } finally {
            frame.node._flags &= ~RUNNING;
          }
        }
        
        frame.phase = 'computed';
        break;
      }
      
      case 'computed': {
        // Node has been computed, pop from stack
        stack.pop();
        visiting.delete(frame.node);
        break;
      }
    }
  }
}