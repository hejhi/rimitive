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
   * Key optimizations from alien-signals:
   * - Uses existing edges as stack frames (no allocations)
   * - Maintains traversal state in temporary edge fields
   * - Early exit for changed signal dependencies
   * - Efficient unwinding without frame objects
   */
  const refreshConsumers = (toNode: ToNode): boolean => {
    // OPTIMIZATION: Only called for INVALIDATED case now
    // STALE is handled inline in hot paths
    if (!(toNode._flags & INVALIDATED)) return false;

    // Already explicitly marked STALE - no need to check dependencies
    if (toNode._flags & STALE) return true;

    // OPTIMIZATION: Fast path for linear chains (single dependency)
    // Common pattern: computed(() => signal.value * 2)
    const firstEdge = toNode._in;

    if (firstEdge && !firstEdge.nextIn) {
      // Skip recycled edges
      if (firstEdge.fromVersion === -1) return false;

      const source = firstEdge.from;
      const edgeVersion = firstEdge.fromVersion;

      // Signals: simple version check
      if (!('_in' in source)) {
        const isStale = edgeVersion !== source._version;
        firstEdge.fromVersion = source._version;
        return isStale;
      }

      // Complex dependency: check flags and version
      const sourceFlags = source._flags || 0;

      // Already marked stale
      if (sourceFlags & STALE) return true;

      // Clean fast path - both version and flags match
      if (edgeVersion === source._version && !(sourceFlags & PENDING)) {
        return false;
      }

      // Need recursive check - fall through to full algorithm
    }

    // Full dependency tree traversal
    let currentTarget = toNode;
    let currentEdge = toNode._in;
    let stackTop: StackFrame | undefined = undefined;
    let stale = false;

    while (true) {
      // Process current dependency
      if (currentEdge) {
        // Skip recycled edges
        if (currentEdge.fromVersion === -1) {
          currentEdge = currentEdge.nextIn;
          continue;
        }

        const source = currentEdge.from;
        const edgeVersion = currentEdge.fromVersion;

        // Signals: compare versions
        if (!('_in' in source)) {
          const sourceVersion = source._version;
          if (edgeVersion !== sourceVersion) {
            stale = true;
            // No early exit - check all siblings for proper batching
          }
          currentEdge.fromVersion = sourceVersion;
          currentEdge = currentEdge.nextIn;
          continue;
        }

        const sourceFlags = source._flags || 0;
        const sourceVersion = source._version;

        // Already marked stale
        if (sourceFlags & STALE) {
          stale = true;
          currentEdge = currentEdge.nextIn;
          continue;
        }

        // Clean dependency - version and flags both clean
        if (edgeVersion === sourceVersion && !(sourceFlags & PENDING)) {
          currentEdge = currentEdge.nextIn;
          continue;
        }

        // Need to dive into this dependency
        if (sourceFlags & INVALIDATED) {
          // Push current state onto stack
          stackTop = {
            edge: currentEdge,
            next: currentEdge.nextIn,
            to: currentTarget,
            stale,
            prev: stackTop,
          };

          // Descend into dependency
          currentTarget = source;
          currentEdge = source._in;
          stale = false;
          continue;
        }

        // Version mismatch without INVALIDATED
        if (edgeVersion !== sourceVersion) {
          stale = true;
          currentEdge.fromVersion = sourceVersion;
        }

        currentEdge = currentEdge.nextIn;
        continue;
      }

      // Finished processing current targetNode's dependencies
      // Clear INVALIDATED on clean nodes
      if (!stale && currentTarget._flags & INVALIDATED) {
        currentTarget._flags &= ~INVALIDATED;
      }

      // Check if we're done
      if (!stackTop) break;

      // Pop from stack
      const frame: StackFrame = stackTop;
      const parentEdge = frame.edge;
      const prevVersion = parentEdge.fromVersion;
      let changed = false;

      // If subtree was stale and this is a computed, update its value now
      if (stale) {
        currentTarget._updateValue();
        if ('_version' in currentTarget) {
          changed = prevVersion !== currentTarget._version;
        }
      }

      // Sync parent edge cached version
      if ('_version' in currentTarget) {
        parentEdge.fromVersion = currentTarget._version;
      }

      // Restore state from stack frame
      currentEdge = frame.next;
      currentTarget = frame.to;
      stackTop = frame.prev;

      // Propagate dirtiness if value changed
      stale = frame.stale || changed;
    }

    // Update final flags
    if (stale) {
      // Dependencies changed - mark as STALE and clear INVALIDATED
      toNode._flags = (toNode._flags & ~INVALIDATED) | STALE;
    } else {
      // False alarm - clear INVALIDATED
      toNode._flags &= ~INVALIDATED;
    }

    return stale;
  };

  return {
    ensureLink,
    unlinkFromProducer,
    connect,
    refreshConsumers,
  };
}
