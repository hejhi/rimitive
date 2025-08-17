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
  connect: (producer: TrackedProducer | (TrackedProducer & ConsumerNode), consumer: ConsumerNode, producerVersion: number) => Edge;
  ensureLink: (producer: TrackedProducer, consumer: ConsumerNode, producerVersion: number) => void;
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
   // ALGORITHM: Edge Creation and Insertion
   // Creates a new edge between producer and consumer, inserting at head of sources
   // and appending to tail of targets for correct effect execution order
   const connect = (
     producer: TrackedProducer | (TrackedProducer & ConsumerNode),
     consumer: ConsumerNode,
     producerVersion: number
   ): Edge => {
     // Get current heads and tails
     const nextIn = consumer._in; // Consumer's current first dependency
     const prevOut = producer._outTail; // Producer's current last dependent
     
     // ALGORITHM: Doubly-Linked List Node Creation
     // Create new edge that will be head of sources, tail of targets
     const newNode: Edge = {
       from: producer,
       to: consumer,
       fromVersion: producerVersion, // Store producer's version at time of edge creation
       toGen: consumer._gen, // Tag with current generation
       prevIn: undefined, // Will be head of sources, so no previous
       prevOut, // Link to current tail of producer's targets
       nextIn, // Link to old head of consumer's sources
       nextOut: undefined, // Will be new tail of targets, so no next
     };

     // Update source list (prepend to consumer's sources)
     if (nextIn) nextIn.prevIn = newNode;
     consumer._in = newNode; // Consumer now depends on this edge first
     
     // FLAG: Computed nodes can be both producers AND consumers
     // When a computed has consumers, we set the TRACKING flag to indicate
     // it's part of an active dependency chain and should update when read
     if ('_flags' in producer) producer._flags |= TRACKING;
     
     // Append to target list (preserve execution order)
     if (prevOut) {
       prevOut.nextOut = newNode;
     } else {
       producer._out = newNode; // First target
     }
     producer._outTail = newNode; // Update tail pointer
     
     // OPTIMIZATION: Update tail pointer for O(1) access to recent dependencies
     if (!consumer._inTail) {
       consumer._inTail = newNode;
     }

     return newNode;
   };
  
  // ALGORITHM: Dependency Registration with Deduplication
  // This is called during signal/computed reads to establish dependencies
  // It either updates an existing edge or creates a new one
  const ensureLink = (
    producer: TrackedProducer,
    consumer: ConsumerNode,
    producerVersion: number
  ): void => {
    // OPTIMIZATION: Check consumer's tail pointer (last accessed dependency)
    // This handles sequential access patterns efficiently
    const tail = consumer._inTail;
    if (tail && tail.from === producer) {
      // Found at tail - update and cache
      tail.fromVersion = producerVersion;
      tail.toGen = consumer._gen;
      // Tail is already correct, no need to update
      return;
    }
    
    // Check the second-to-last edge (common for alternating patterns)
    if (tail?.prevIn && tail.prevIn.from === producer) {
      const edge = tail.prevIn;
      edge.fromVersion = producerVersion;
      edge.toGen = consumer._gen;
      consumer._inTail = edge; // Move to tail for next access
      return;
    }
    
    // FALLBACK: Linear search from head
    // Look for existing edge (active or recyclable)
    let node = consumer._in;
    while (node) {
      if (node.from === producer) {
        // Found edge - either active (version >= 0) or recyclable (version = -1)
        // Reactivate/update it
        node.fromVersion = producerVersion;
        node.toGen = consumer._gen;
        // Move to tail for better locality
        consumer._inTail = node;
        return;
      }
      node = node.nextIn;
    }

    // No existing edge found - create new one
    connect(producer, consumer, producerVersion);
  };

  // ALGORITHM: Edge Removal from Producer's Target List  
  // Removes an edge from the producer's linked list of consumers
  // This is O(1) because we have direct pointers to neighbors
  const unlinkFromProducer = ({ from, prevOut, nextOut }: Edge): void => {
    // Remove from doubly-linked list
    if (prevOut) {
      // Middle or end of list - update previous node
      prevOut.nextOut = nextOut;
    } else {
      // Head of list - update producer's head pointer
      from._out = nextOut;

      // OPTIMIZATION: Only check TRACKING flag if this was the last consumer
      // Combine the checks to reduce branches
      if (!nextOut && '_flags' in from) from._flags &= ~TRACKING;
    }
    
    if (nextOut) {
      nextOut.prevOut = prevOut;
    } else {
      // This was the tail - update tail pointer
      from._outTail = prevOut;
    }
  };

  /**
   * ALGORITHM: Zero-Allocation Dependency Checking with Intrusive Stack
   * 
   * Key optimizations:
   * - Uses existing edges as stack frames (no allocations)
   * - Single-pass traversal with inline edge recycling
   * - Monomorphic signal/computed paths for V8 optimization
   * - Minimal flag operations and branch reduction
   */
  const refreshConsumers = (toNode: ToNode): boolean => {
    // Cache flags to avoid repeated property access
    const nodeFlags = toNode._flags;
    if (!(nodeFlags & INVALIDATED)) return false;
    if (nodeFlags & STALE) return true;

    // Fast path for single dependency
    const firstEdge = toNode._in;
    if (firstEdge && !firstEdge.nextIn && firstEdge.fromVersion !== -1) {
      const source = firstEdge.from;
      const oldVersion = firstEdge.fromVersion;
      firstEdge.fromVersion = source._version;
      
      // Monomorphic signal path
      if (!('_in' in source)) {
        return oldVersion !== source._version;
      }
      
      // Computed path
      const flags = source._flags;
      if (flags & STALE) return true;
      if (oldVersion === source._version && !(flags & PENDING)) return false;
    }

    // Main traversal
    let currentTarget = toNode;
    let currentEdge = toNode._in;
    let stackTop: StackFrame | undefined = undefined;
    let stale = false;

    while (true) {
      // Inline recycled edge skipping with null check
      while (currentEdge?.fromVersion === -1) {
        currentEdge = currentEdge.nextIn;
      }

      if (currentEdge) {
        const source = currentEdge.from;
        const oldVersion = currentEdge.fromVersion;
        const newVersion = source._version;
        
        // Update version once
        currentEdge.fromVersion = newVersion;
        const versionChanged = oldVersion !== newVersion;
        
        // Monomorphic signal fast path
        if (!('_in' in source)) {
          stale = stale || versionChanged;
          currentEdge = currentEdge.nextIn;
          continue;
        }
        
        // Computed node handling
        const flags = source._flags;
        
        // Already stale - propagate
        if (flags & STALE) {
          stale = true;
          currentEdge = currentEdge.nextIn;
          continue;
        }
        
        // Clean dependency - skip
        if (!versionChanged && !(flags & PENDING)) {
          currentEdge = currentEdge.nextIn;
          continue;
        }
        
        // Needs recursion
        if (flags & INVALIDATED) {
          stackTop = {
            edge: currentEdge,
            next: currentEdge.nextIn,
            to: currentTarget,
            stale,
            prev: stackTop,
          };
          currentTarget = source;
          currentEdge = source._in;
          stale = false;
          continue;
        }
        
        // Version changed without INVALIDATED
        stale = stale || versionChanged;
        currentEdge = currentEdge.nextIn;
        continue;
      }

      // Clear INVALIDATED if clean
      if (!stale) {
        currentTarget._flags &= ~INVALIDATED;
      }

      // Done if no stack
      if (!stackTop) break;

      // Pop stack
      const frame: StackFrame = stackTop;
      const parentEdge = frame.edge;

      if (stale) {
        currentTarget._updateValue();
        // Check if computed value changed
        if ('_version' in currentTarget) {
          const newTargetVersion = currentTarget._version;
          const changed = parentEdge.fromVersion !== newTargetVersion;
          parentEdge.fromVersion = newTargetVersion;
          stale = changed;
        }
      }

      // Restore state
      currentEdge = frame.next;
      currentTarget = frame.to;
      stackTop = frame.prev;
      stale = frame.stale || stale;
    }

    // Single flag update
    toNode._flags = stale ? 
      (nodeFlags & ~INVALIDATED) | STALE : 
      nodeFlags & ~INVALIDATED;

    return stale;
  };

  return {
    ensureLink,
    unlinkFromProducer,
    connect,
    refreshConsumers,
  };
}
