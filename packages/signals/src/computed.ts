// Simplified Computed implementation - bare metal

import type { DependencyNode, Effect } from './types';
import type { Computed as ComputedInterface } from './types';
import type { Selected } from './select';
import {
  NOTIFIED,
  OUTDATED,
  RUNNING,
  DISPOSED,
  TRACKING,
  IS_COMPUTED,
} from './types';
import { activeContext } from './signal';
import { releaseNode } from './node-pool';

// Direct class syntax - cleaner and more idiomatic
class Computed<T> implements ComputedInterface<T> {
  __type = 'computed' as const;
  _compute: () => T;
  _value: T | undefined = undefined;
  _version = 0;
  _globalVersion = -1;
  _flags = OUTDATED | IS_COMPUTED;
  _sources: DependencyNode | undefined = undefined;
  _targets: DependencyNode | undefined = undefined;
  _node: DependencyNode | undefined = undefined;

  constructor(fn: () => T) {
    this._compute = fn;
  }

  // Methods will be added via prototype below
  declare subscribe: (listener: () => void) => () => void;
  declare select: <R>(selector: (value: T) => R) => Selected<R>;

  // Value property - moved to class for benchmarking
  get value(): T {
    trackDependency(this, activeContext.currentComputed);
    this._refresh();
    return this._value!;
  }

  // Simplified refresh - inline everything for performance
  _refresh(): boolean {
    this._flags &= ~NOTIFIED;

    if (this._flags & RUNNING) throw new Error('Cycle detected');

    if (shouldSkipRefresh(this)) return true;

    this._flags &= ~OUTDATED;
    this._flags |= RUNNING;

    // Check if we actually need to recompute
    if (this._version > 0 && !needsToRecompute(this)) {
      this._flags &= ~RUNNING;
      return true;
    }

    // Recompute needed
    const prevComputed = activeContext.currentComputed;
    try {
      prepareSources(this);
      activeContext.currentComputed = this;
      
      computeNewValue(this);
      this._globalVersion = activeContext.version;
    } finally {
      activeContext.currentComputed = prevComputed;
      cleanupSources(this);
      this._flags &= ~RUNNING;
    }

    return true;
  }

  // Notify targets
  _notify(): void {
    if (this._flags & NOTIFIED) return;
    this._flags |= NOTIFIED | OUTDATED;

    let node = this._targets;
    while (node) {
      node.target._notify();
      node = node.nextTarget;
    }
  }

  dispose(): void {
    if (this._flags & DISPOSED) return;

    this._flags |= DISPOSED;
    disposeAllSources(this);
    this._value = undefined;
  }

  // Peek method - read value without tracking
  peek(): T {
    this._refresh();
    return this._value!;
  };
}

// Helper: Prepare sources for re-evaluation
function prepareSources<T>(computed: Computed<T>): void {
  // Simply mark all current sources as potentially unused
  for (
    let node = computed._sources;
    node !== undefined;
    node = node.nextSource
  ) {
    node.version = -1; // Mark as potentially unused
  }
}

// Helper: Clean up sources after re-evaluation
function cleanupSources<T>(computed: Computed<T>): void {
  let node = computed._sources;
  let prev: DependencyNode | undefined;

  while (node !== undefined) {
    const next = node.nextSource;

    if (node.version === -1) {
      removeNode(node, prev, computed);
      // prev stays the same since we removed the current node
    } else {
      // This node was re-used, keep it
      prev = node;
    }

    node = next;
  }
}

// Check if recomputation is needed
function needsToRecompute<T>(computed: Computed<T>): boolean {
  // Check dependencies in order of use
  for (
    let node = computed._sources;
    node !== undefined;
    node = node.nextSource
  ) {
    const source = node.source;

    // Three checks as in Preact:
    // 1. Version already changed (fast path)
    if (node.version !== source._version) return true;

    // 2. Try to refresh the source (handles nested computeds)
    if (!source._refresh()) return true;

    // 3. Check if version changed after refresh
    if (node.version !== source._version) return true;
  }

  return false;
}

// Direct export instead of factory pattern
export function computed<T>(fn: () => T): ComputedInterface<T> {
  return new Computed(fn);
}

// Helper: Track dependency relationship between computed and target
function trackDependency<T>(computed: Computed<T>, target: ComputedInterface<T> | Effect | null): void {
  if (!target || !(target._flags & RUNNING)) return;
  
  const version = computed._version;
  
  // Try fast paths first
  if (tryReuseNode(computed, target, version)) return;
  if (findExistingDependency(target, computed, version)) return;
  
  // Slow path: create new dependency
  createNewDependency(computed, target, version);
}

// Helper: Try to reuse cached node for the same target
function tryReuseNode<T>(computed: Computed<T>, target: ComputedInterface<T> | Effect, version: number): boolean {
  const node = computed._node;
  if (node !== undefined && node.target === target) {
    node.version = version;
    return true;
  }
  return false;
}

// Helper: Search for existing dependency in target's sources
function findExistingDependency<T>(target: ComputedInterface<T> | Effect, computed: Computed<T>, version: number): boolean {
  let node = target._sources;
  while (node) {
    if (node.source === computed) {
      node.version = version;
      return true;
    }
    node = node.nextSource;
  }
  return false;
}

// Helper: Create and link a new dependency node
function createNewDependency<T>(computed: Computed<T>, target: ComputedInterface<T> | Effect, version: number): void {
  const newNode = allocateNode();
  
  // Initialize node
  newNode.source = computed;
  newNode.target = target;
  newNode.version = version;
  newNode.nextSource = target._sources;
  newNode.nextTarget = computed._targets;
  newNode.prevSource = undefined;
  newNode.prevTarget = undefined;
  
  // Link into lists
  linkNode(newNode, computed, target);
  
  // Cache for reuse
  computed._node = newNode;
}

// Helper: Allocate a node from the pool or create new
function allocateNode(): DependencyNode {
  activeContext.allocations++;
  if (activeContext.poolSize > 0) {
    activeContext.poolHits++;
    return activeContext.nodePool[--activeContext.poolSize]!;
  }
  activeContext.poolMisses++;
  return {} as DependencyNode;
}

// Helper: Link node into both source and target lists
function linkNode<T>(node: DependencyNode, computed: Computed<T>, target: ComputedInterface<T> | Effect): void {
  // Link to target's sources
  if (target._sources) {
    target._sources.prevSource = node;
  }
  target._sources = node;
  
  // Link to computed's targets
  if (computed._targets) {
    computed._targets.prevTarget = node;
  } else {
    computed._flags |= TRACKING;
  }
  computed._targets = node;
}

// Helper: Check if refresh can be skipped
function shouldSkipRefresh<T>(computed: Computed<T>): boolean {
  // CRITICAL OPTIMIZATION: Check global version FIRST before any other work
  // This is the most important optimization for diamond patterns
  // Only use global version optimization if we're not outdated
  if (
    !(computed._flags & OUTDATED) &&
    computed._version > 0 &&
    computed._globalVersion === activeContext.version
  ) {
    return true;
  }
  
  // Fast path: tracking and not outdated
  if ((computed._flags & (OUTDATED | TRACKING)) === TRACKING) {
    return true;
  }
  
  return false;
}

// Helper: Compute new value and update if changed
function computeNewValue<T>(computed: Computed<T>): boolean {
  const value = computed._compute();
  if (computed._value !== value || computed._version === 0) {
    computed._value = value;
    computed._version++;
    return true; // value changed
  }
  return false; // value unchanged
}

// Helper: Remove a dependency node from all linked lists
function removeNode<T>(node: DependencyNode, prev: DependencyNode | undefined, computed: ComputedInterface<T>): void {
  const next = node.nextSource;
  
  // Remove from sources list
  if (prev !== undefined) {
    prev.nextSource = next;
  } else {
    computed._sources = next;
  }
  if (next !== undefined) {
    next.prevSource = prev;
  }
  
  // Remove from source's targets
  removeFromTargets(node);
  
  // Return node to pool
  releaseNode(node);
}

// Helper: Remove node from its source's target list
function removeFromTargets(node: DependencyNode): void {
  const source = node.source;
  const prevTarget = node.prevTarget;
  const nextTarget = node.nextTarget;
  
  if (prevTarget !== undefined) {
    prevTarget.nextTarget = nextTarget;
  } else {
    source._targets = nextTarget;
    // Clear tracking flag if no more targets
    if (nextTarget === undefined && '_flags' in source) {
      source._flags &= ~TRACKING;
    }
  }
  
  if (nextTarget !== undefined) {
    nextTarget.prevTarget = prevTarget;
  }
}

// Helper: Dispose all source connections and release nodes
function disposeAllSources<T>(computed: Computed<T>): void {
  let node = computed._sources;
  const nodesToRelease: DependencyNode[] = [];
  
  while (node) {
    const next = node.nextSource;
    removeFromTargets(node);
    nodesToRelease.push(node);
    node = next;
  }
  
  // Batch release for better performance
  for (const nodeToRelease of nodesToRelease) {
    releaseNode(nodeToRelease);
  }
  
  computed._sources = undefined;
}

// Export the Computed constructor for prototype extensions
export { Computed };

// Export helper for use in effect.ts
export { removeFromTargets };
