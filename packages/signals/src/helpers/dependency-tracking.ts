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
import type { SignalContext } from '../context';

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
  checkNodeDirty: (node: ConsumerNode & { _globalVersion?: number }, ctx: SignalContext) => boolean;
  shouldNodeUpdate: (node: ConsumerNode & { _flags: number; _globalVersion?: number }, ctx: SignalContext) => boolean;
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
     if ('_flags' in source && typeof source._flags === 'number') source._flags |= TRACKING;
     
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
      // Edge exists in cache - just update version
      node.version = version;
      return;
    }
    
    // ALGORITHM: Linear Search for Existing Edge
    // Search through consumer's dependency list for existing edge
    // This is O(n) but typically n is small (most computeds have few dependencies)
    node = target._sources;
    while (node) {
      if (node.source === source) {
        // Found existing edge - update version and cache it
        node.version = version;
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
      if (isLastTarget && '_flags' in source && typeof source._flags === 'number') {
        source._flags &= ~TRACKING;
      }
    }

    if (!isLastTarget) {
      // Update next node's back pointer
      nextTarget.prevTarget = prevTarget;
    }
  };

  /**
   * ALGORITHM: Recursive Dirty Checking with Global Version Optimization
   * 
   * Determines if a consumer needs to recompute by checking if any of its
   * dependencies have changed. Uses two-level version checking:
   * 1. Global version - if nothing in the system changed, node is clean
   * 2. Local versions - check each dependency's version against cached edge version
   * 
   * For computed dependencies, recursively updates them first to get fresh values.
   * This implements "pull-based" lazy evaluation.
   */
  const checkNodeDirty = (
    node: ConsumerNode & { _globalVersion?: number },
    ctx: SignalContext
  ): boolean => {
    // OPTIMIZATION: Global Version Check
    // If the global version hasn't changed since last check, no signals changed
    // This avoids traversing dependencies when nothing happened
    if (node._globalVersion === ctx.version) return false;
    
    // ALGORITHM: Dependency Chain Traversal
    // Walk through all dependencies, checking if any changed
    let source = node._sources;
    while (source) {
      const sourceNode = source.source;
      
      // Handle computed dependencies differently from signals
      // FIXME: This type checking is fragile - should use a more robust discriminator
      if ('_update' in sourceNode && '_flags' in sourceNode && typeof (sourceNode as unknown as {_update: unknown})._update === 'function') {
        // ALGORITHM: Recursive Computed Update (Pull-based evaluation)
        // Before checking if computed changed, ensure it's up-to-date
        // This creates a recursive pull through the dependency chain
        const oldVersion = sourceNode._version;
        (sourceNode as unknown as {_update(): void})._update();
        
        // If computed's version changed after update, we're dirty
        if (oldVersion !== sourceNode._version) return true;
      } else if (source.version !== sourceNode._version) {
        // Simple signal - just compare versions
        // Edge version is from when dependency was established
        // Source version is current - mismatch means it changed
        return true;
      }
      
      // OPTIMIZATION: Update cached edge version to avoid rechecking
      // Next time we check, we'll know we've already seen this version
      source.version = sourceNode._version;
      source = source.nextSource;
    }
    
    // ALGORITHM: Clean State Caching
    // All dependencies are clean - cache the global version to skip
    // this entire check next time if nothing changes globally
    node._globalVersion = ctx.version;
    return false;
  };

  /**
   * ALGORITHM: Two-Phase Update Check
   * 
   * Determines if a node needs to execute using a two-phase approach:
   * 1. NOTIFIED phase - marked as "maybe dirty" during push invalidation
   * 2. OUTDATED phase - confirmed dirty after checking dependencies
   * 
   * This allows the push phase to be fast (just marking) while the pull
   * phase does the actual verification. This is crucial for performance
   * when many signals change but not all paths lead to actual changes.
   */
  const shouldNodeUpdate = (
    node: ConsumerNode & { _flags: number; _globalVersion?: number },
    ctx: SignalContext
  ): boolean => {
    const flags = node._flags;
    
    // OPTIMIZATION: Early exit if node is known clean
    // Neither NOTIFIED nor OUTDATED means nothing to do
    if (!(flags & (OUTDATED | NOTIFIED))) return false;
    
    // OUTDATED is definitive - node must update
    if (flags & OUTDATED) return true;
    
    // ALGORITHM: Lazy Verification
    // NOTIFIED means "might be dirty" - verify by checking dependencies
    if (flags & NOTIFIED) {
      if (checkNodeDirty(node, ctx)) {
        // Dependencies did change - mark as OUTDATED for next time
        node._flags |= OUTDATED;
        return true;
      } else {
        // False alarm - dependencies didn't actually change
        // Clear NOTIFIED flag to mark as clean
        node._flags &= ~NOTIFIED;
        return false;
      }
    }
    
    // TODO: Is this reachable? Add assertion or remove
    return false;
  };

  return { addDependency, removeFromTargets, linkNodes, checkNodeDirty, shouldNodeUpdate };
}