// Simplified Computed implementation - bare metal

import type { DependencyNode } from './types';
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
  _fn: () => T;
  _value: T | undefined = undefined;
  _version = 0;
  _globalVersion = -1;
  _flags = OUTDATED | IS_COMPUTED;
  _sources: DependencyNode | undefined = undefined;
  _targets: DependencyNode | undefined = undefined;
  _node: DependencyNode | undefined = undefined;

  constructor(fn: () => T) {
    this._fn = fn;
  }

  // Methods will be added via prototype below
  declare subscribe: (listener: () => void) => () => void;
  declare select: <R>(selector: (value: T) => R) => Selected<R>;

  // Value property - moved to class for benchmarking
  get value(): T {
    const current = activeContext.currentComputed;

    // Track this computed as dependency if needed
    if (current && current._flags & RUNNING) {
      const version = this._version;

      // Node reuse pattern - check if we can reuse existing node
      let node = this._node;
      if (node !== undefined && node.target === current) {
        // Reuse existing node - just update version
        node.version = version;
      } else {
        // Check if already tracking this computed in current context
        node = current._sources;
        while (node) {
          if (node.source === this) {
            node.version = version;
            break;
          }
          node = node.nextSource;
        }

        if (!node) {
          // Create new dependency node using context pool
          activeContext.allocations++;
          const newNode =
            activeContext.poolSize > 0
              ? (activeContext.poolHits++,
                activeContext.nodePool[--activeContext.poolSize]!)
              : (activeContext.poolMisses++, {} as DependencyNode);
          newNode.source = this;
          newNode.target = current;
          newNode.version = version;
          newNode.nextSource = current._sources;
          newNode.nextTarget = this._targets;
          newNode.prevSource = undefined;
          newNode.prevTarget = undefined;

          if (current._sources) {
            current._sources.prevSource = newNode;
          }
          current._sources = newNode;

          if (this._targets) {
            this._targets.prevTarget = newNode;
          } else {
            this._flags |= TRACKING;
          }
          this._targets = newNode;

          // Store node for reuse
          this._node = newNode;
        }
      }
    }

    this._refresh();
    return this._value!;
  }

  // Simplified refresh - inline everything for performance
  _refresh(): boolean {
    this._flags &= ~NOTIFIED;

    if (this._flags & RUNNING) throw new Error('Cycle detected');

    // CRITICAL OPTIMIZATION: Check global version FIRST before any other work
    // This is the most important optimization for diamond patterns
    // Only use global version optimization if we're not outdated
    if (
      !(this._flags & OUTDATED) &&
      this._version > 0 &&
      this._globalVersion === activeContext.version
    )
      return true;

    // Fast path: tracking and not outdated
    if ((this._flags & (OUTDATED | TRACKING)) === TRACKING) return true;

    this._flags &= ~OUTDATED;

    // Mark as running before checking dependencies
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

      const value = this._fn();
      if (this._value !== value || this._version === 0) {
        this._value = value;
        this._version++;
      }

      // Update global version after successful computation
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
    if (!(this._flags & DISPOSED)) {
      this._flags |= DISPOSED;

      // Clear all sources and return nodes to pool
      let node = this._sources;
      const nodesToRelease: DependencyNode[] = [];

      while (node) {
        const next = node.nextSource;
        const source = node.source;
        const prevTarget = node.prevTarget;
        const nextTarget = node.nextTarget;

        if (prevTarget) {
          prevTarget.nextTarget = nextTarget;
        } else {
          source._targets = nextTarget;
        }

        if (nextTarget) {
          nextTarget.prevTarget = prevTarget;
        }

        // Collect node for batch release
        nodesToRelease.push(node);
        node = next;
      }

      // Batch release for better performance
      for (const nodeToRelease of nodesToRelease) {
        releaseNode(nodeToRelease);
      }

      this._sources = undefined;
      this._value = undefined;
    }
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
      // This node was not re-used, remove it

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

      // Return node to pool
      releaseNode(node);
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
export function computed<T>(fn: () => T): Computed<T> {
  return new Computed(fn);
}

// Export the Computed constructor for prototype extensions
export { Computed };
