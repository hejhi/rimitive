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
import type { ProducerNode, ConsumerNode, Edge, TargetNode } from '../types';

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
  nextLink: Edge | undefined;
  target: TargetNode;
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
     const nextSource = consumer._sources; // Consumer's current first dependency
     const prevTarget = producer._targetsTail; // Producer's current last dependent
     
     // ALGORITHM: Doubly-Linked List Node Creation
     // Create new edge that will be head of sources, tail of targets
     const newNode: Edge = {
       source: producer,
       target: consumer,
       version: producerVersion, // Store producer's version at time of edge creation
       runVersion: consumer._runVersion, // Tag with current run version
       prevSource: undefined, // Will be head of sources, so no previous
       prevTarget, // Link to current tail of producer's targets  
       nextSource, // Link to old head of consumer's sources
       nextTarget: undefined, // Will be new tail of targets, so no next
     };

     // Update source list (prepend to consumer's sources)
     if (nextSource) nextSource.prevSource = newNode;
     consumer._sources = newNode; // Consumer now depends on this edge first
     
     // FLAG: Computed nodes can be both producers AND consumers
     // When a computed has consumers, we set the TRACKING flag to indicate
     // it's part of an active dependency chain and should update when read
     if ('_flags' in producer) producer._flags |= TRACKING;
     
     // Append to target list (preserve execution order)
     if (prevTarget) {
       prevTarget.nextTarget = newNode;
     } else {
       producer._targets = newNode; // First target
     }
     producer._targetsTail = newNode; // Update tail pointer
     
     // OPTIMIZATION: Update tail pointer for O(1) access to recent dependencies
     if (!consumer._sourcesTail) {
       consumer._sourcesTail = newNode;
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
    const tail = consumer._sourcesTail;
    if (tail && tail.source === producer) {
      // Found at tail - update and cache
      tail.version = producerVersion;
      tail.runVersion = consumer._runVersion;
      // Tail is already correct, no need to update
      return;
    }
    
    // Check the second-to-last edge (common for alternating patterns)
    if (tail?.prevSource && tail.prevSource.source === producer) {
      const edge = tail.prevSource;
      edge.version = producerVersion;
      edge.runVersion = consumer._runVersion;
      consumer._sourcesTail = edge; // Move to tail for next access
      return;
    }
    
    // FALLBACK: Linear search from head
    // Look for existing edge (active or recyclable)
    let node = consumer._sources;
    while (node) {
      if (node.source === producer) {
        // Found edge - either active (version >= 0) or recyclable (version = -1)
        // Reactivate/update it
        node.version = producerVersion;
        node.runVersion = consumer._runVersion;
        // Move to tail for better locality
        consumer._sourcesTail = node;
        return;
      }
      node = node.nextSource;
    }

    // No existing edge found - create new one
    connect(producer, consumer, producerVersion);
  };

  // ALGORITHM: Edge Removal from Producer's Target List  
  // Removes an edge from the producer's linked list of consumers
  // This is O(1) because we have direct pointers to neighbors
  const unlinkFromProducer = ({ source, prevTarget, nextTarget }: Edge): void => {
    // Remove from doubly-linked list
    if (prevTarget) {
      // Middle or end of list - update previous node
      prevTarget.nextTarget = nextTarget;
    } else {
      // Head of list - update producer's head pointer
      source._targets = nextTarget;

      // OPTIMIZATION: Only check TRACKING flag if this was the last consumer
      // Combine the checks to reduce branches
      if (!nextTarget && '_flags' in source) (source._flags &= ~TRACKING);
    }
    
    if (nextTarget) {
      nextTarget.prevTarget = prevTarget;
    } else {
      // This was the tail - update tail pointer
      source._targetsTail = prevTarget;
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
  const refreshConsumers = (targetNode: TargetNode): boolean => {
    // OPTIMIZATION: Only called for INVALIDATED case now
    // STALE is handled inline in hot paths
    if (!(targetNode._flags & INVALIDATED)) return false;

    // Already explicitly marked STALE - no need to check dependencies
    if (targetNode._flags & STALE) return true;

    // OPTIMIZATION: Fast path for linear chains (single dependency)
    // Common pattern: computed(() => signal.value * 2)
    const firstEdge = targetNode._sources;

    if (firstEdge && !firstEdge.nextSource) {
      // Skip recycled edges
      if (firstEdge.version === -1) return false;

      const source = firstEdge.source;
      const edgeVersion = firstEdge.version;

      // Signals: simple version check
      if (!('_sources' in source)) {
        const isStale = edgeVersion !== source._version;
        firstEdge.version = source._version;
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
    let currentTarget = targetNode;
    let currentEdge = targetNode._sources;
    let stackTop: StackFrame | undefined = undefined;
    let stale = false;

    while (true) {
      // Process current dependency
      if (currentEdge) {
        // Skip recycled edges
        if (currentEdge.version === -1) {
          currentEdge = currentEdge.nextSource;
          continue;
        }

        const source = currentEdge.source;
        const edgeVersion = currentEdge.version;

        // Signals: compare versions
        if (!('_sources' in source)) {
          const sourceVersion = source._version;
          if (edgeVersion !== sourceVersion) {
            stale = true;
            // No early exit - check all siblings for proper batching
          }
          currentEdge.version = sourceVersion;
          currentEdge = currentEdge.nextSource;
          continue;
        }

        const sourceFlags = source._flags || 0;
        const sourceVersion = source._version;

        // Already marked stale
        if (sourceFlags & STALE) {
          stale = true;
          currentEdge = currentEdge.nextSource;
          continue;
        }

        // Clean dependency - version and flags both clean
        if (edgeVersion === sourceVersion && !(sourceFlags & PENDING)) {
          currentEdge = currentEdge.nextSource;
          continue;
        }

        // Need to dive into this dependency
        if (sourceFlags & INVALIDATED) {
          // Push current state onto stack
          stackTop = {
            edge: currentEdge,
            nextLink: currentEdge.nextSource,
            target: currentTarget,
            stale,
            prev: stackTop,
          };

          // Descend into dependency
          currentTarget = source;
          currentEdge = source._sources;
          stale = false;
          continue;
        }

        // Version mismatch without INVALIDATED
        if (edgeVersion !== sourceVersion) {
          stale = true;
          currentEdge.version = sourceVersion;
        }

        currentEdge = currentEdge.nextSource;
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
      const prevVersion = parentEdge.version;
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
        parentEdge.version = currentTarget._version;
      }

      // Restore state from stack frame
      currentEdge = frame.nextLink;
      currentTarget = frame.target;
      stackTop = frame.prev;

      // Propagate dirtiness if value changed
      stale = frame.stale || changed;
    }

    // Update final flags
    if (stale) {
      // Dependencies changed - mark as STALE and clear INVALIDATED
      targetNode._flags = (targetNode._flags & ~INVALIDATED) | STALE;
    } else {
      // False alarm - clear INVALIDATED
      targetNode._flags &= ~INVALIDATED;
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
