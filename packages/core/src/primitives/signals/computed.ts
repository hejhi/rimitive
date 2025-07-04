// Computed value implementation

import type { Computed, DependencyNode } from './types';
import { NOTIFIED, OUTDATED, RUNNING, DISPOSED, TRACKING, IS_COMPUTED } from './types';
import { SignalScope } from './scope';
import { NodeScope } from './node';

export type ComputedScope = {
  computed: <T>(fn: () => T) => Computed<T>;
  isOutdated: <T>(computed: Computed<T>) => boolean;
};

// Stable helper functions - no 'this' binding
function readComputed<T>(c: Computed<T>, scope: SignalScope, node: NodeScope): T {
  // Ultra-fast path: Most common case - not disposed, tracking, and not outdated
  const flags = c._flags;
  if ((flags & (DISPOSED | OUTDATED | TRACKING)) === TRACKING) {
    // Still need to track dependency if we're being tracked
    const current = scope.currentComputed;
    if (current !== null && (current._flags & RUNNING)) {
      node.addDependency(c, current);
    }
    return c._value!;
  }
  
  // Check if disposed (less common)
  if (flags & DISPOSED) {
    throw new Error('Computed is disposed');
  }

  // Always track dependency first (if we're being tracked)
  const current = scope.currentComputed;
  if (current !== null && (current._flags & RUNNING)) {
    node.addDependency(c, current);
  }

  // If already marked outdated, skip all version checks
  if (c._flags & OUTDATED) {
    return recomputeValue(c, scope, node);
  }

  // Not outdated but need to check if anything changed
  // Check if global version changed (always update our version)
  if (c._globalVersion !== scope.globalVersion) {
    c._globalVersion = scope.globalVersion;
    
    // Only check sources if we have any
    if (c._sources) {
      let sourceNode: DependencyNode | undefined = c._sources;
      while (sourceNode) {
        if (sourceNode.version !== sourceNode.source._version) {
          // Found outdated source - mark and recompute immediately
          c._flags |= OUTDATED;
          return recomputeValue(c, scope, node);
        }
        sourceNode = sourceNode.nextSource;
      }
    }
  }

  // Everything is up to date - return cached value
  return c._value!;
}

function notifyComputed(c: Computed<unknown>, node: NodeScope): void {
  if (!(c._flags & NOTIFIED)) {
    c._flags |= NOTIFIED | OUTDATED;
    // Reset global version to force recheck
    c._globalVersion = 0;
    // Propagate notification to our targets
    node.notifyTargets(c);
  }
}

function recomputeValue<T>(c: Computed<T>, scope: SignalScope, node: NodeScope): T {
  if (c._flags & RUNNING) {
    throw new Error('Cycle detected');
  }

  c._flags |= RUNNING;
  c._flags &= ~NOTIFIED;

  // Prepare sources for potential cleanup
  node.prepareSources(c);

  const prevComputed = scope.currentComputed;
  scope.currentComputed = c;

  try {
    c._value = c._fn();
    c._version++;
  } finally {
    scope.currentComputed = prevComputed;
    c._flags &= ~(RUNNING | OUTDATED);
  }

  // Clean up unused sources
  node.cleanupSources(c);

  return c._value;
}

function disposeComputed(c: Computed<unknown>, node: NodeScope): void {
  if (!(c._flags & DISPOSED)) {
    c._flags |= DISPOSED;
    node.disposeComputed(c);
    c._value = undefined;
  }
}

export function createComputedScope(
  scope: SignalScope,
  node: NodeScope
): ComputedScope {
  function computed<T>(fn: () => T): Computed<T> {
    // Use a regular function but bind to stable helpers
    const c = function computedRead() {
      return readComputed(c, scope, node);
    } as Computed<T>;
    
    // Initialize all properties in exact same order
    c._fn = fn;
    c._value = undefined;
    c._version = 0;
    c._globalVersion = 0;
    c._flags = OUTDATED | IS_COMPUTED;
    c._sources = undefined;
    c._sourcesTail = undefined;
    c._targets = undefined;
    c._targetsTail = undefined;
    c.subscribe = undefined;  // Pre-define to maintain stable shape

    // Pre-bound stable functions - no 'this' needed
    c._notify = () => notifyComputed(c, node);
    c._recompute = () => recomputeValue(c, scope, node);
    c.dispose = () => disposeComputed(c, node);

    return c;
  }

  // Utility function to check if a computed needs recalculation
  function isOutdated<T>(computed: Computed<T>): boolean {
    return !!(computed._flags & OUTDATED);
  }

  return {
    computed,
    isOutdated,
  };
}
