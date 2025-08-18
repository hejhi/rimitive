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
  unlink: (edge: Edge) => Edge | undefined;
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
  // ALGORITHM: Simplified Edge Management with Pruning Support
  // Uses tail-based caching with minimal reordering for pruning correctness
  const link = (
    producer: TrackedProducer,
    consumer: ConsumerNode,
    producerVersion: number
  ): void => {
    // OPTIMIZATION: Check tail (most recently accessed dependency)
    const tail = consumer._inTail;
    if (tail !== undefined && tail.from === producer) {
      tail.fromVersion = producerVersion;
      return;
    }
    
    // Check next after tail (2-element cache)
    const nextAfterTail = tail !== undefined ? tail.nextIn : consumer._in;
    if (nextAfterTail !== undefined && nextAfterTail.from === producer) {
      nextAfterTail.fromVersion = producerVersion;
      consumer._inTail = nextAfterTail;
      return;
    }
    
    // Linear search for existing edge
    let edge = nextAfterTail;
    while (edge) {
      if (edge.from === producer) {
        edge.fromVersion = producerVersion;
        
        // Move edge to tail position for pruning correctness
        // Only move if not already adjacent to tail
        if (edge !== nextAfterTail) {
          // Remove from current position
          if (edge.prevIn) edge.prevIn.nextIn = edge.nextIn;
          if (edge.nextIn) edge.nextIn.prevIn = edge.prevIn;
          
          // Insert after tail
          edge.prevIn = tail;
          edge.nextIn = nextAfterTail;
          if (nextAfterTail) nextAfterTail.prevIn = edge;
          if (tail) {
            tail.nextIn = edge;
          } else {
            consumer._in = edge;
          }
        }
        
        consumer._inTail = edge;
        return;
      }
      edge = edge.nextIn;
    }

    // No existing edge - create new one at tail position
    const prevDep = tail;
    const nextDep = tail !== undefined ? tail.nextIn : consumer._in;
    const prevOut = producer._outTail;
    
    const newEdge: Edge = {
      from: producer,
      to: consumer,
      fromVersion: producerVersion,
      prevIn: prevDep,
      prevOut,
      nextIn: nextDep,
      nextOut: undefined,
    };

    // Update consumer's input list
    if (nextDep) nextDep.prevIn = newEdge;
    if (prevDep) {
      prevDep.nextIn = newEdge;
    } else {
      consumer._in = newEdge;
    }
    consumer._inTail = newEdge;
    
    // Set TRACKING flag if producer is a computed node
    if ('_flags' in producer) (producer as TrackedProducer & ConsumerNode)._flags |= TRACKING;
    
    // Update producer's output list
    if (prevOut) {
      prevOut.nextOut = newEdge;
    } else {
      producer._out = newEdge;
    }
    producer._outTail = newEdge;
  };

  // ALGORITHM: Full Bidirectional Edge Removal (alien-signals pattern)
  // Removes an edge from both producer and consumer lists in O(1)
  // Returns the next edge in consumer's list for easy iteration
  const unlink = (edge: Edge): Edge | undefined => {
    const { from, to, prevIn, nextIn, prevOut, nextOut } = edge;
    
    // Remove from consumer's input list
    if (nextIn) nextIn.prevIn = prevIn;
    else to._inTail = prevIn;
    
    if (prevIn) prevIn.nextIn = nextIn;
    else to._in = nextIn;
    
    // Remove from producer's output list
    if (nextOut) nextOut.prevOut = prevOut;
    else from._outTail = prevOut;
    
    if (prevOut) {
      prevOut.nextOut = nextOut;
    } else {
      from._out = nextOut;
      // Clear TRACKING flag if this was the last consumer
      if (!nextOut && '_flags' in from) {
        from._flags &= ~TRACKING;
      }
    }
    
    return nextIn;
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
    unlink,
    refreshConsumers,
  };
}
