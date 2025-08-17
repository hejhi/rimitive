/**
 * ALGORITHM: Bidirectional Dependency Graph Management
 * 
 * This module implements the core graph algorithms that power the reactive system.
 * The key insight is using a bidirectional graph with intrusive linked lists:
 * 
 * INSPIRATION:
 * - Glimmer's reference system (version tracking)
 * - Linux kernel's intrusive lists (memory efficiency)  
 * - V8's inline caches (edge caching)
 * - Database query planners (dependency analysis)
 */
import { CONSTANTS } from '../constants';
import type { ProducerNode, ConsumerNode, Edge, ToNode } from '../types';

// OPTIMIZATION: Edge Caching
// Producers cache their last accessed edge to avoid linked list traversal
// This optimization is based on the observation that the same consumer
// often accesses the same producer multiple times in succession
export type TrackedProducer = ProducerNode;

const { TRACKING, INVALIDATED, STALE, PENDING } = CONSTANTS;

export interface DependencyGraph {
  link: (producer: TrackedProducer, consumer: ConsumerNode, producerVersion: number) => void;
  unlinkFromProducer: (edge: Edge) => void;
  refreshConsumers: (consumer: ConsumerNode) => boolean;
}

// Stack frame type - follows Alien's pattern, never mutates Edge
interface StackFrame {
  edge: Edge;
  next: Edge | undefined;
  to: ToNode;
  stale: boolean;
  prev: StackFrame | undefined;
}

export function createDependencyGraph(): DependencyGraph {
  // ALGORITHM: Unified Edge Management (inspired by alien-signals)
  // Combines edge creation and update into single function
  // Checks tail first for O(1) common case, then creates if needed
  const link = (
    producer: TrackedProducer,
    consumer: ConsumerNode,
    producerVersion: number
  ): void => {
    // OPTIMIZATION: Check tail (most recently accessed dependency)
    const tail = consumer._inTail;
    if (tail !== undefined && tail.from === producer) {
      // Found at tail - just update version
      tail.fromVersion = producerVersion;
      tail.toGen = consumer._gen;
      return;
    }
    
    // Check next from tail (common for alternating patterns)
    const nextFromTail = tail !== undefined ? tail.nextIn : consumer._in;
    if (nextFromTail !== undefined && nextFromTail.from === producer) {
      nextFromTail.fromVersion = producerVersion;
      nextFromTail.toGen = consumer._gen;
      consumer._inTail = nextFromTail;
      return;
    }
    
    // FALLBACK: Linear search from head
    let node = consumer._in;
    while (node) {
      if (node.from === producer) {
        // Found edge - update and move to tail
        node.fromVersion = producerVersion;
        node.toGen = consumer._gen;
        consumer._inTail = node;
        return;
      }
      node = node.nextIn;
    }

    // No existing edge - create new one
    const nextIn = consumer._in;
    const prevOut = producer._outTail;
    
    // Create new edge - head of sources, tail of targets
    const newNode: Edge = {
      from: producer,
      to: consumer,
      fromVersion: producerVersion,
      toGen: consumer._gen,
      prevIn: undefined,
      prevOut,
      nextIn,
      nextOut: undefined,
    };

    // Update source list (prepend)
    if (nextIn) nextIn.prevIn = newNode;
    consumer._in = newNode;
    
    // Set TRACKING flag if producer is a computed node
    if ('_flags' in producer) (producer as TrackedProducer & ConsumerNode)._flags |= TRACKING;
    
    // Append to target list
    if (prevOut) {
      prevOut.nextOut = newNode;
    } else {
      producer._out = newNode;
    }
    producer._outTail = newNode;
    
    // Update tail pointer for O(1) access
    if (!consumer._inTail) {
      consumer._inTail = newNode;
    }
  };

  // ALGORITHM: Edge Removal from Producer's Target List  
  // Removes an edge from the producer's linked list of consumers
  // This is O(1) because we have direct pointers to neighbors
  const unlinkFromProducer = ({ from, prevOut, nextOut }: Edge): void => {
    // Update neighbor pointers
    if (prevOut) {
      prevOut.nextOut = nextOut;
    } else {
      from._out = nextOut;
      // Clear TRACKING flag if this was the last consumer
      if (!nextOut && '_flags' in from) {
        from._flags &= ~TRACKING;
      }
    }
    
    if (nextOut) {
      nextOut.prevOut = prevOut;
    } else {
      from._outTail = prevOut;
    }
  };

  /**
   * ALGORITHM: Zero-Allocation Dependency Checking
   * Streamlined single-pass traversal with intrusive stack
   */
  const refreshConsumers = (toNode: ToNode): boolean => {
    const flags = toNode._flags;
    if (!(flags & INVALIDATED)) return false;
    if (flags & STALE) return true;

    let node = toNode;
    let edge = toNode._in;
    let stack: StackFrame | undefined;
    let stale = false;

    while (true) {
      // Process edges for current node
      while (edge) {
        // Skip recycled edges
        if (edge.fromVersion === -1) {
          edge = edge.nextIn;
          continue;
        }

        const source = edge.from;
        const oldVersion = edge.fromVersion;
        const newVersion = source._version;
        edge.fromVersion = newVersion;
        const changed = oldVersion !== newVersion;
        
        // Branch on node type for better prediction
        if ('_in' in source) {
          // Computed node
          const sourceFlags = source._flags;
          
          if (sourceFlags & STALE) {
            stale = true;
          } else if (changed || (sourceFlags & PENDING)) {
            if (sourceFlags & INVALIDATED) {
              // Push to stack and recurse
              stack = { edge, next: edge.nextIn, to: node, stale, prev: stack };
              node = source;
              edge = source._in;
              stale = false;
              continue;
            }
            stale = true;
          }
        } else {
          // Signal node - just version check
          stale = stale || changed;
        }
        
        edge = edge.nextIn;
      }

      // Process current node
      if (!stale) {
        node._flags &= ~INVALIDATED;
      }
      
      // Check if we need to unwind stack
      if (!stack) break;

      // Stack unwind
      const frame = stack;
      if (stale) {
        node._updateValue();
        if ('_version' in node) {
          stale = frame.edge.fromVersion !== node._version;
          frame.edge.fromVersion = node._version;
        }
      }

      edge = frame.next;
      node = frame.to;
      stack = frame.prev;
      stale = frame.stale || stale;
    }

    // Update final flags
    toNode._flags = stale 
      ? (flags | STALE) & ~INVALIDATED
      : flags & ~INVALIDATED;
    
    return stale;
  };

  return {
    link,
    unlinkFromProducer,
    refreshConsumers,
  };
}
