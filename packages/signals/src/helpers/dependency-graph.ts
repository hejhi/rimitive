/**
 * ALGORITHM: Bidirectional Dependency Graph Management
 * 
 * This module implements the core graph algorithms that power the reactive system.
 * The key insight is using a bidirectional graph with intrusive linked lists:
 * 
 * 1. INTRUSIVE LINKED LISTS:
 *    - Edges ARE the list nodes (no separate allocation)
 *    - Each edge belongs to TWO lists simultaneously:
 *      a) Producer's target list (forward edges)
 *      b) Consumer's source list (backward edges)
 *    - Enables O(1) insertion and removal
 *    - Better cache locality than pointer-based graphs
 * 
 * 2. EDGE CACHING OPTIMIZATION:
 *    - Producers cache their last accessed edge
 *    - Exploits temporal locality - same consumer often reads repeatedly
 *    - Turns O(n) search into O(1) in common case
 *    - Inspired by CPU inline caches
 * 
 * 3. VERSION-BASED STALENESS DETECTION:
 *    - Each edge stores the producer's version when created
 *    - Comparing edge.version to producer._version detects changes
 *    - More efficient than stale flags or timestamps
 *    - Handles the "diamond problem" correctly
 * 
 * 4. DYNAMIC DEPENDENCY DISCOVERY:
 *    - Dependencies detected at runtime, not declared
 *    - Supports conditional logic naturally
 *    - Dependencies can change between computations
 *    - Similar to mobx/vue but without proxies
 * 
 * INSPIRATION:
 * - Glimmer's reference system (version tracking)
 * - Linux kernel's intrusive lists (memory efficiency)  
 * - V8's inline caches (edge caching)
 * - Database query planners (dependency analysis)
 */
import { CONSTANTS } from '../constants';
import type { ProducerNode, ConsumerNode, Edge } from '../types';

// OPTIMIZATION: Edge Caching
// Producers cache their last accessed edge to avoid linked list traversal
// This optimization is based on the observation that the same consumer
// often accesses the same producer multiple times in succession
export type EdgeCache = { _lastEdge?: Edge };
export type TrackedProducer = ProducerNode & EdgeCache;

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
  consumer: ConsumerNode;
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
       gen: consumer._runVersion ?? 0, // Tag with current consumer generation
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
     
     // OPTIMIZATION: Cache this edge for fast repeated access
     producer._lastEdge = newNode;

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
    // OPTIMIZATION: Check cached edge first (O(1) fast path)
    const cached = producer._lastEdge;
    if (cached && cached.target === consumer) {
      // Edge exists in cache - just update version and generation tag
      cached.version = producerVersion;
      cached.gen = consumer._runVersion ?? 0;
      // Move to tail if not already there
      if (consumer._sourcesTail !== cached) {
        consumer._sourcesTail = cached;
      }
      return;
    }
    
    // OPTIMIZATION: Check consumer's tail pointer (last accessed dependency)
    // This handles sequential access patterns efficiently
    const tail = consumer._sourcesTail;
    if (tail && tail.source === producer) {
      // Found at tail - update and cache
      tail.version = producerVersion;
      tail.gen = consumer._runVersion ?? 0;
      producer._lastEdge = tail;
      // Tail is already correct, no need to update
      return;
    }
    
    // Check the second-to-last edge (common for alternating patterns)
    if (tail?.prevSource && tail.prevSource.source === producer) {
      const edge = tail.prevSource;
      edge.version = producerVersion;
      edge.gen = consumer._runVersion ?? 0;
      producer._lastEdge = edge;
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
        node.gen = consumer._runVersion ?? 0;
        producer._lastEdge = node;
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
  const refreshConsumers = (consumer: ConsumerNode): boolean => {
    // OPTIMIZATION: Only called for INVALIDATED case now
    // STALE is handled inline in hot paths
    if (!(consumer._flags & INVALIDATED)) return false;

    // If all direct sources have matching versions and are not themselves
    // stale, we can clear INVALIDATED and skip expensive checks.
    let edge = consumer._sources;
    let stale = false;

    while (edge) {
      const { source, version } = edge;
      // Skip recycled edges (version = -1)
      if (version !== -1) {
        if (version !== source._version) {
          stale = true;
          break;
        }

        // Use compound PENDING check
        if ('_flags' in source && source._flags & PENDING) {
          stale = true;
          break;
        }
      }

      edge = edge.nextSource;
    }

    if (!stale) {
      consumer._flags &= ~INVALIDATED;
      return false;
    }

    // If we got here, we have something stale so we should continue.
    // TODO: is the above redundant?
    stale = false;

    if (consumer._flags & STALE) return true;

    // OPTIMIZATION: Fast path for linear chains (single dependency)
    // Common pattern: computed(() => signal.value * 2)
    // Skip complex traversal when there's only one active dependency
    const firstEdge = consumer._sources;
    if (firstEdge && !firstEdge.nextSource) {
      const firstEdgeVersion = firstEdge.version;
      // Single dependency - check directly
      if (firstEdgeVersion === -1) return false; // Recycled edge

      const firstEdgeSource = firstEdge.source;

      // Signals: simple version check
      if (!('_sources' in firstEdgeSource)) {
        const stale = firstEdgeVersion !== firstEdgeSource._version;
        firstEdge.version = firstEdgeSource._version;
        return stale;
      }

      // If we're here, the firstEdgeSource is both a producer and a consumer node, with its own sources
      // Check flags and version
      const firstEdgeSourceFlags = firstEdgeSource._flags || 0;
      if (firstEdgeSourceFlags & STALE) return true;

      // Clean fast path
      // Check if the edge version matches the source version and isn't stale. If so, we can return.
      // NOTE: what's the difference between PENDING, a version check, and INVALIDATED?
      if (
        firstEdgeVersion === firstEdgeSource._version &&
        !(firstEdgeSourceFlags & PENDING)
      ) {
        return false;
      }

      // Need to check nested - fall through to full algorithm
    }

    // Use separate stack frames for traversal state
    let currentConsumer = consumer;
    let currentEdge = consumer._sources;
    let stackTop: StackFrame | undefined = undefined; // Stack of parent frames

    while (true) {
      // Process current dependency
      if (currentEdge) {
        // Skip recycled edges
        if (currentEdge.version === -1) {
          currentEdge = currentEdge.nextSource;
          continue;
        }

        const consumerSource = currentEdge.source;
        const currentEdgeVersion = currentEdge.version;

        // Signals: compare versions
        if (!('_sources' in consumerSource)) {
          const v = consumerSource._version;
          if (currentEdgeVersion !== v) {
            stale = true;
            // No early exit - check all siblings for proper batching
          }
          currentEdge.version = v;
          currentEdge = currentEdge.nextSource;
          continue;
        }

        const sourceFlags = consumerSource._flags || 0;
        const currentVersion = consumerSource._version;

        // Explicitly outdated dependency
        if (sourceFlags & STALE) {
          stale = true;
          // Continue checking siblings - no early exit
          currentEdge = currentEdge.nextSource;
          continue;
        }

        // Clean dependency fast path - check both version and no stale flags
        if (
          currentEdgeVersion === currentVersion &&
          !(sourceFlags & PENDING)
        ) {
          currentEdge = currentEdge.nextSource;
          continue;
        }

        // Need to dive into this dependency
        if (sourceFlags & INVALIDATED) {
          // Push current state onto stack with new frame
          stackTop = {
            edge: currentEdge,
            nextLink: currentEdge.nextSource,
            consumer: currentConsumer,
            stale,
            prev: stackTop,
          };

          // Descend into dependency
          currentConsumer = consumerSource;
          currentEdge = consumerSource._sources;
          stale = false;
          continue;
        }

        // Version mismatch without INVALIDATED
        if (currentEdgeVersion !== currentVersion) {
          stale = true;
          currentEdge.version = currentVersion;
          // No early exit - continue checking siblings
        }

        currentEdge = currentEdge.nextSource;
        continue;
      }

      // Finished processing current sub's dependencies
      // Clear INVALIDATED on clean nodes
      if (!stale && currentConsumer._flags & INVALIDATED) {
        currentConsumer._flags &= ~INVALIDATED;
      }

      // Check if we're done
      if (!stackTop) break;

      // Pop from stack
      const frame: StackFrame = stackTop;
      const parentEdge: Edge = frame.edge;
      const prevVersion: number = parentEdge.version;
      let changed = false;

      // If subtree was stale and this is a computed, recompute now
      if (stale) {
        currentConsumer._onOutdated();
        if ('_version' in currentConsumer) {
          changed = prevVersion !== currentConsumer._version;
        }
      }

      // Sync parent edge cached version
      if (
        '_version' in currentConsumer &&
        typeof currentConsumer._version === 'number'
      ) {
        parentEdge.version = currentConsumer._version;
      }

      // Restore state from stack frame
      currentEdge = frame.nextLink;
      currentConsumer = frame.consumer;
      stackTop = frame.prev;

      // No cleanup needed - frame will be GC'd

      // Propagate dirtiness if value changed
      stale = frame.stale || changed;
    }

    if (stale) {
      // Dependencies changed - mark as STALE and clear INVALIDATED
      consumer._flags = (consumer._flags & ~INVALIDATED) | STALE;
    } else {
      // False alarm - clear INVALIDATED and cache global version
      consumer._flags &= ~INVALIDATED;
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
