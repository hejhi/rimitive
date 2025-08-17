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
  // Uses 2-element cache for O(1) access to recently used edges
  const link = (
    producer: TrackedProducer,
    consumer: ConsumerNode,
    producerVersion: number
  ): void => {
    // OPTIMIZATION: Check tail (most recently accessed dependency)
    const tail = consumer._inTail;
    if (tail !== undefined && tail.from === producer) {
      // Found at tail - update version
      tail.fromVersion = producerVersion;
      return;
    }
    
    // Check next after tail (or head if no tail)
    const nextAfterTail = tail !== undefined ? tail.nextIn : consumer._in;
    if (nextAfterTail !== undefined && nextAfterTail.from === producer) {
      // Found right after tail - update version and move tail forward
      nextAfterTail.fromVersion = producerVersion;
      consumer._inTail = nextAfterTail;
      return;
    }
    
    // Linear search through the rest
    let node = nextAfterTail;
    while (node) {
      if (node.from === producer) {
        // Found edge - update version and move it after current tail
        node.fromVersion = producerVersion;
        
        // If not immediately after tail, move it there
        if (node !== nextAfterTail) {
          // Remove from current position
          if (node.prevIn) node.prevIn.nextIn = node.nextIn;
          if (node.nextIn) node.nextIn.prevIn = node.prevIn;
          
          // Insert after tail
          node.prevIn = tail;
          node.nextIn = nextAfterTail;
          if (nextAfterTail) nextAfterTail.prevIn = node;
          if (tail) {
            tail.nextIn = node;
          } else {
            consumer._in = node;
          }
        }
        
        // Update tail to this edge
        consumer._inTail = node;
        return;
      }
      node = node.nextIn;
    }

    // No existing edge - create new one
    const prevDep = tail;
    const nextDep = tail !== undefined ? tail.nextIn : consumer._in;
    const prevOut = producer._outTail;
    
    // Create new edge - insert after tail
    const newNode: Edge = {
      from: producer,
      to: consumer,
      fromVersion: producerVersion,
      prevIn: prevDep,
      prevOut,
      nextIn: nextDep,
      nextOut: undefined,
    };

    // Update consumer's dependency list
    if (nextDep !== undefined) {
      nextDep.prevIn = newNode;
    }
    if (prevDep !== undefined) {
      prevDep.nextIn = newNode;
    } else {
      consumer._in = newNode;
    }
    
    // Move tail forward to the new edge
    consumer._inTail = newNode;
    
    // Set TRACKING flag if producer is a computed node
    if ('_flags' in producer) (producer as TrackedProducer & ConsumerNode)._flags |= TRACKING;
    
    // Append to producer's target list
    if (prevOut) {
      prevOut.nextOut = newNode;
    } else {
      producer._out = newNode;
    }
    producer._outTail = newNode;
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
