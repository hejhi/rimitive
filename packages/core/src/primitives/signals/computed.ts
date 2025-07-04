// Computed value implementation

import type { Computed, DependencyNode } from './types';
import { NOTIFIED, OUTDATED, RUNNING, DISPOSED, TRACKING, IS_COMPUTED } from './types';
import type { SignalScope } from './scope';
import type { NodeScope } from './node';

export type ComputedScope = {
  computed: <T>(fn: () => T) => Computed<T>;
  isOutdated: <T>(computed: Computed<T>) => boolean;
};

// Computed constructor function
function ComputedImpl<T>(this: Computed<T>, fn: () => T) {
  this._fn = fn;
  this._value = undefined;
  this._version = 0;
  this._globalVersion = 0;
  this._flags = OUTDATED | IS_COMPUTED;
  this._sources = undefined;
  this._sourcesTail = undefined;
  this._targets = undefined;
  this._targetsTail = undefined;
  this._scope = undefined;
  this._node = undefined;
}

// Cast to get the right constructor type
const Computed = ComputedImpl as unknown as {
  new <T>(fn: () => T): Computed<T>;
  prototype: Computed;
};

// Define the value property on the prototype
Object.defineProperty(Computed.prototype, 'value', {
  get(this: Computed) {
    // Ultra-fast path: Most common case - not disposed, tracking, and not outdated
    const flags = this._flags;
    if ((flags & (DISPOSED | OUTDATED | TRACKING)) === TRACKING) {
      // Still need to track dependency if we're being tracked
      const current = this._scope?.currentComputed;
      if (current !== null && current !== undefined && (current._flags & RUNNING)) {
        this._node.addDependency(this, current);
      }
      return this._value!;
    }
    
    // Check if disposed (less common)
    if (flags & DISPOSED) {
      throw new Error('Computed is disposed');
    }

    // Always track dependency first (if we're being tracked)
    const current = this._scope?.currentComputed;
    if (current !== null && current !== undefined && (current._flags & RUNNING)) {
      this._node?.addDependency(this, current);
    }

    // If already marked outdated, skip all version checks
    if (this._flags & OUTDATED) {
      return this._recompute();
    }

    // Fast path: if global version hasn't changed, nothing to check
    if (this._scope && this._globalVersion === this._scope.globalVersion) {
      return this._value!;
    }

    // Not outdated but need to check if anything changed
    // Update our global version
    if (this._scope) {
      this._globalVersion = this._scope.globalVersion;
    }
    
    // Only check sources if we have any
    if (this._sources) {
      let sourceNode: DependencyNode | undefined = this._sources;
      while (sourceNode) {
        if (sourceNode.version !== sourceNode.source._version) {
          // Found outdated source - mark and recompute immediately
          this._flags |= OUTDATED;
          return this._recompute();
        }
        sourceNode = sourceNode.nextSource;
      }
    }

    // Everything is up to date - return cached value
    return this._value!;
  }
});

// Add methods to the prototype
Computed.prototype._notify = function(this: Computed): void {
  if (!(this._flags & NOTIFIED)) {
    this._flags |= NOTIFIED | OUTDATED;
    // Reset global version to force recheck
    this._globalVersion = 0;
    // Propagate notification to our targets
    this._node?.notifyTargets(this);
  }
};

Computed.prototype._recompute = function<T>(this: Computed<T>): T {
  if (this._flags & RUNNING) {
    throw new Error('Cycle detected');
  }

  this._flags |= RUNNING;
  this._flags &= ~NOTIFIED;

  // Prepare sources for potential cleanup
  this._node?.prepareSources(this);

  const prevComputed = this._scope?.currentComputed;
  if (this._scope) {
    this._scope.currentComputed = this;
  }

  try {
    this._value = this._fn();
    this._version++;
  } finally {
    if (this._scope) {
      this._scope.currentComputed = prevComputed;
    }
    this._flags &= ~(RUNNING | OUTDATED);
  }

  // Clean up unused sources
  this._node?.cleanupSources(this);

  return this._value;
};

Computed.prototype.dispose = function(this: Computed): void {
  if (!(this._flags & DISPOSED)) {
    this._flags |= DISPOSED;
    this._node?.disposeComputed(this);
    this._value = undefined;
  }
};

// Add subscribe method to prototype (will be overridden by subscribe scope)
Computed.prototype.subscribe = function(this: Computed, _fn: (value: any) => void) {
  return () => {};
};

export function createComputedScope(
  scope: SignalScope,
  node: NodeScope
): ComputedScope {
  function computed<T>(fn: () => T): Computed<T> {
    const c = new Computed(fn);
    // Store scope references directly on the computed
    c._scope = scope;
    c._node = node;
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
