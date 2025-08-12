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
 *    - More efficient than dirty flags or timestamps
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

const { TRACKING, NOTIFIED, OUTDATED } = CONSTANTS;

export interface DependencyGraph {
  connect: (producer: TrackedProducer | (TrackedProducer & ConsumerNode), consumer: ConsumerNode, producerVersion: number) => Edge;
  ensureLink: (producer: TrackedProducer, consumer: ConsumerNode, producerVersion: number) => void;
  unlinkFromProducer: (edge: Edge) => void;
  hasStaleDependencies: (consumer: ConsumerNode) => boolean;
  needsRecompute: (consumer: ConsumerNode & { _flags: number }) => boolean;
}

export function createDependencyGraph(): DependencyGraph {
   // ALGORITHM: Edge Creation and Insertion
   // Creates a new edge between producer and consumer, inserting it at the head
   // of both linked lists for O(1) insertion
   const connect = (
     producer: TrackedProducer | (TrackedProducer & ConsumerNode),
     consumer: ConsumerNode,
     producerVersion: number
   ): Edge => {
     // Get current heads of both linked lists
     const nextSource = consumer._sources; // Consumer's current first dependency
     const nextTarget = producer._targets; // Producer's current first dependent
     
     // ALGORITHM: Doubly-Linked List Node Creation
     // Create new edge that will become the new head of both lists
     const newNode: Edge = {
       source: producer,
       target: consumer,
       version: producerVersion, // Store producer's version at time of edge creation
       gen: consumer._gen ?? 0, // Tag with current consumer generation
       prevSource: undefined, // Will be head, so no previous
       prevTarget: undefined, // Will be head, so no previous  
       nextSource, // Link to old head of consumer's sources
       nextTarget, // Link to old head of producer's targets
     };

     // Update old heads to point back to new node
     if (nextTarget) nextTarget.prevTarget = newNode;
     
     // FLAG: Computed nodes can be both producers AND consumers
     // When a computed has consumers, we set the TRACKING flag to indicate
     // it's part of an active dependency chain and should update when read
     if ('_flags' in producer) producer._flags |= TRACKING;
     
     if (nextSource) nextSource.prevSource = newNode;

     // Insert at head of both linked lists
     consumer._sources = newNode; // Consumer now depends on this edge first
     producer._targets = newNode; // Producer now notifies this edge first
     
     // OPTIMIZATION: Update tail pointer for O(1) access to recent dependencies
     if (!consumer._sourcesTail) {
       consumer._sourcesTail = newNode;
     }
     
     // OPTIMIZATION: Cache this edge for fast repeated access
     producer._lastEdge = newNode;
     consumer._sourcesTail = newNode;

     return newNode;
   };
  
  // ALGORITHM: Dependency Registration with Deduplication
  // This is called during signal/computed reads to establish dependencies
  // It either updates an existing edge or creates a new one
  const ensureLink = (
    producer: ProducerNode & EdgeCache,
    consumer: ConsumerNode,
    producerVersion: number
  ): void => {
    // OPTIMIZATION: Check cached edge first (O(1) fast path)
    const cached = producer._lastEdge;
    if (cached && cached.target === consumer) {
      // Edge exists in cache - just update version and generation tag
      cached.version = producerVersion;
      cached.gen = consumer._gen ?? 0;
      // Move to tail if not already there
      if (consumer._sourcesTail !== cached) {
        consumer._sourcesTail = cached;
      }
      return;
    }
    
    // OPTIMIZATION: Check consumer's tail pointer (last accessed dependency)
    // This handles alternating access patterns efficiently
    const tail = consumer._sourcesTail;
    if (tail && tail.source === producer) {
      // Found at tail - update and cache
      tail.version = producerVersion;
      tail.gen = consumer._gen ?? 0;
      producer._lastEdge = tail;
      return;
    }
    
    // Check the second-to-last edge (common for alternating patterns)
    if (tail?.prevSource && tail.prevSource.source === producer) {
      const edge = tail.prevSource;
      edge.version = producerVersion;
      edge.gen = consumer._gen ?? 0;
      producer._lastEdge = edge;
      consumer._sourcesTail = edge; // Move to tail for next access
      return;
    }
    
    // FALLBACK: Linear search when caches miss (like alien-signals)
    // This is rare (<5% of cases) with tail pointer optimization
    let node = consumer._sources;
    while (node) {
      if (node.source === producer) {
        // Found edge - update and cache
        node.version = producerVersion;
        node.gen = consumer._gen ?? 0;
        producer._lastEdge = node;
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
    
    if (!nextTarget) return;
    nextTarget.prevTarget = prevTarget;
  };

  /**
   * ALGORITHM: Preact-style Dependency Checking with _refresh()
   * 
   * Determines if a consumer needs to recompute by checking if any of its
   * dependencies have changed. This follows preact-signals' pattern:
   * 1. Check version mismatch first (fast path)
   * 2. Call _refresh() on computed dependencies (recursive but controlled)
   * 3. Check version again after refresh
   * 
   * The recursion happens through _refresh() calls, but it's controlled by
   * RUNNING flags and global version checks to prevent stack overflow.
   */
  /**
   * ALGORITHM: Preact-style Dependency Checking with _refresh()
   * 
   * Determines if a consumer needs to recompute by checking if any of its
   * dependencies have changed. This follows preact-signals' pattern:
   * 1. Check version mismatch first (fast path)
   * 2. Call _refresh() on computed dependencies (recursive but controlled)
   * 3. Check version again after refresh
   * 
   * The recursion happens through _refresh() calls, but it's controlled by
   * RUNNING flags and global version checks to prevent stack overflow.
   */
  const hasStaleDependencies = (consumer: ConsumerNode): boolean => {
    let source = consumer._sources;
    while (source) {
      const sourceNode = source.source;
      const edgeVersion = source.version;
      const currentVersion = sourceNode._version;
      
      // Fast path for signals - no dependencies to check
      if (!('_sources' in sourceNode)) {
        if (edgeVersion !== currentVersion) return true;
        // Update edge version for clean signal
        source.version = currentVersion;
        source = source.nextSource;
        continue;
      }
      
      // OPTIMIZATION: Combined check for clean computeds
      // Check flags and version in one condition to reduce branches
      if (
        edgeVersion === currentVersion &&
        !(sourceNode._flags & (NOTIFIED | OUTDATED))
      ) {
        source = source.nextSource;
        continue;
      }
      
      // Computed needs refresh - check if it actually changed
      if (!sourceNode._refresh()) return true;
      
      // Check if version changed after refresh
      const newVersion = sourceNode._version;
      if (edgeVersion !== newVersion) return true;
      
      // Update edge version for next time
      source.version = newVersion;
      source = source.nextSource;
    }
    
    return false;
  };

  /**
   * ALGORITHM: Two-Phase Update Check
   * 
   * Determines if a node needs to execute using a two-phase approach:
   * 1. NOTIFIED phase - marked as "maybe dirty" during push invalidation
   * 2. OUTDATED phase - confirmed dirty after checking dependencies
   * 
   * OPTIMIZATION: This version is split for performance:
   * - Fast path (OUTDATED check) is inlined in hot paths
   * - This function handles the slower NOTIFIED case
   */
  const needsRecompute = (
    node: ConsumerNode & { _flags: number; },
  ): boolean => {
    // OPTIMIZATION: Only called for NOTIFIED case now
    // OUTDATED is handled inline in hot paths
    if (!(node._flags & NOTIFIED)) return false;
    
    // If all direct sources have matching versions and are not themselves
    // NOTIFIED/OUTDATED, we can clear NOTIFIED and skip expensive checks.
    let e = node._sources;
    let clean = true;
    while (e) {
      const s = e.source as ProducerNode & { _flags?: number };
      if (e.version !== s._version) { clean = false; break; }
      if ('_flags' in s && (s._flags! & (NOTIFIED | OUTDATED))) { clean = false; break; }
      e = e.nextSource!;
    }
    if (clean) {
      node._flags &= ~NOTIFIED;
      return false;
    }
    
    // Check if dependencies actually changed
    const isDirty = hasStaleDependencies(node);
    
    if (isDirty) {
      // Dependencies changed - mark as OUTDATED for next time
      node._flags |= OUTDATED;
    } else {
      // False alarm - clear NOTIFIED and cache global version
      node._flags &= ~NOTIFIED;
    }
    
    return isDirty;
  };

  return { ensureLink, unlinkFromProducer, connect, hasStaleDependencies, needsRecompute };
}
