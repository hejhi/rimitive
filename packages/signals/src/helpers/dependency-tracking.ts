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

export interface DependencyHelpers {
  linkNodes: (source: TrackedProducer | (TrackedProducer & ConsumerNode), target: ConsumerNode, version: number) => Edge;
  addDependency: (source: TrackedProducer, target: ConsumerNode, version: number) => void;
  removeFromTargets: (edge: Edge) => void;
  checkNodeDirty: (node: ConsumerNode) => boolean;
  shouldNodeUpdate: (node: ConsumerNode & { _flags: number; }, ctx?: { version: number }) => boolean;
  isNodeClean: (node: ConsumerNode & { _flags: number }, flags: number) => boolean;
}

export function createDependencyHelpers(): DependencyHelpers {
   // ALGORITHM: Edge Creation and Insertion
   // Creates a new edge between producer and consumer, inserting it at the head
   // of both linked lists for O(1) insertion
   const linkNodes = (
     source: TrackedProducer | (TrackedProducer & ConsumerNode),
     target: ConsumerNode,
     version: number
   ): Edge => {
     // Get current heads of both linked lists
     const nextSource = target._sources; // Consumer's current first dependency
     const nextTarget = source._targets; // Producer's current first dependent
     
     // ALGORITHM: Doubly-Linked List Node Creation
     // Create new edge that will become the new head of both lists
     const newNode: Edge = {
       source,
       target,
       version, // Store producer's version at time of edge creation
       generation: target._generation, // Store consumer's generation for cleanup
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
     if ('_flags' in source) source._flags |= TRACKING;
     
     if (nextSource) nextSource.prevSource = newNode;

     // Insert at head of both linked lists
     target._sources = newNode; // Consumer now depends on this edge first
     source._targets = newNode; // Producer now notifies this edge first
     
     // OPTIMIZATION: Cache this edge for fast repeated access
     source._lastEdge = newNode;

     return newNode;
   };
  
  // ALGORITHM: Dependency Registration with Deduplication
  // This is called during signal/computed reads to establish dependencies
  // It either updates an existing edge or creates a new one
  const addDependency = (
    source: ProducerNode & EdgeCache,
    target: ConsumerNode,
    version: number
  ): void => {
    // OPTIMIZATION: Check cached edge first (O(1) fast path)
    let node = source._lastEdge;
    if (node !== undefined && node.target === target) {
      // Edge exists in cache - just update version and generation
      node.version = version;
      node.generation = target._generation;
      return;
    }
    
    // ALGORITHM: Linear Search for Existing Edge
    // Search through consumer's dependency list for existing edge
    // This is O(n) but typically n is small (most computeds have few dependencies)
    node = target._sources;
    while (node) {
      if (node.source === source) {
        // Found existing edge - update version, generation and cache it
        node.version = version;
        node.generation = target._generation;
        // OPTIMIZATION: Update cache for next access
        source._lastEdge = node;
        return;
      }
      node = node.nextSource;
    }

    // No existing edge found - create new one
    linkNodes(source, target, version);
  };

  // ALGORITHM: Edge Removal from Producer's Target List  
  // Removes an edge from the producer's linked list of consumers
  // This is O(1) because we have direct pointers to neighbors
  const removeFromTargets = ({ source, prevTarget, nextTarget }: Edge): void => {
    const isLastTarget = nextTarget === undefined;

    // Remove from doubly-linked list
    if (prevTarget !== undefined) {
      // Middle or end of list - update previous node
      prevTarget.nextTarget = nextTarget;
    } else {
      // Head of list - update producer's head pointer
      source._targets = nextTarget;

      // ALGORITHM: TRACKING Flag Management
      // If this was the last consumer and source is also a computed,
      // clear TRACKING flag since it has no downstream dependencies
      // This allows the computed to skip updates when not observed
      if (isLastTarget && '_flags' in source) {
        source._flags &= ~TRACKING;
      }
    }

    if (isLastTarget) return;

    // Update next node's back pointer
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
  const checkNodeDirty = (
    node: ConsumerNode
  ): boolean => {
    // ALGORITHM: Dependency Chain Traversal
    // Walk through all dependencies, checking if any changed
    let source = node._sources;
    while (source) {
      const sourceNode = source.source;
      
      // OPTIMIZATION: Fast path for signals (no dependencies)
      // Signals don't have _sources, so we can check them quickly
      if (!('_sources' in sourceNode)) {
        // Signal changed, we're dirty
        if (source.version !== sourceNode._version) return true;

        // Signal unchanged, update edge version and continue
        source.version = sourceNode._version;
        source = source.nextSource;
        continue;
      }
      
      // Complex path for computeds (has dependencies)
      // ALGORITHM: Optimized dependency check for computeds
      
      // OPTIMIZATION: Early exit for clean computeds
      // If the computed has clean flags and our edge version matches,
      // we can skip the refresh entirely
      if ('_flags' in sourceNode) {
        const flags = sourceNode._flags;
        const isClean = !(flags & (NOTIFIED | OUTDATED));
        const versionMatches = source.version === sourceNode._version;
        
        if (isClean && versionMatches) {
          // This computed is clean and hasn't changed since we last read it
          // Skip the expensive _refresh call
          source = source.nextSource;
          continue;
        }
      }
      
      // Phase 1: Refresh computed dependencies if potentially dirty
      // This ensures they check THEIR dependencies and recompute if needed
      // The key insight: _refresh() will only increment version if value changed
      const refreshFailed = !sourceNode._refresh();
      
      // Phase 2: Check if the refresh produced a new version
      // If version is still the same, the computed's VALUE didn't change
      // even though its dependencies might have new versions
      const versionChanged = source.version !== sourceNode._version;
      
      // Dependency value changed - we're dirty
      if (refreshFailed || versionChanged) return true;
      
      // ALGORITHM: Edge Version Synchronization
      // The dependency is clean (value hasn't changed)
      // Update the edge version to prevent redundant checks
      source.version = sourceNode._version;
      source = source.nextSource;
    }
    
    // All dependencies are clean
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
  const shouldNodeUpdate = (
    node: ConsumerNode & { _flags: number; },
  ): boolean => {
    // OPTIMIZATION: Only called for NOTIFIED case now
    // OUTDATED is handled inline in hot paths
    if (!(node._flags & NOTIFIED)) return false;
    
    // Check if dependencies actually changed
    const isDirty = checkNodeDirty(node);
    
    if (isDirty) {
      // Dependencies changed - mark as OUTDATED for next time
      node._flags |= OUTDATED;
    } else {
      // False alarm - clear NOTIFIED and cache global version
      node._flags &= ~NOTIFIED;
    }
    
    return isDirty;
  };

  /**
   * OPTIMIZATION: Pure inline-friendly check
   * Simple flag check that V8 can inline effectively.
   * No side effects, just a boolean return.
   */
  const isNodeClean = (
    node: ConsumerNode & { _flags: number },
    dirtyMask: number
  ): boolean => {
    return (node._flags & dirtyMask) === 0;
  };

  return { addDependency, removeFromTargets, linkNodes, checkNodeDirty, shouldNodeUpdate, isNodeClean };
}