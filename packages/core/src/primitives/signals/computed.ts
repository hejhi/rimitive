// Computed value implementation

import type { Computed, DependencyNode } from './types';
import {
  NOTIFIED,
  OUTDATED,
  RUNNING,
  DISPOSED,
  TRACKING,
  IS_COMPUTED,
} from './types';
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
  this._globalVersion = -1;
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
    // Early exit for disposed
    if (this._flags & DISPOSED) {
      throw new Error('Computed is disposed');
    }

    // Check if we're being tracked and inline dependency tracking
    const scope = this._scope;
    if (scope) {
      const current = scope.currentComputed;
      if (current && current._flags & RUNNING) {
        // Inline addDependency logic for hot path
        let node = current._sources;
        let found = false;

        // Fast check if we already track this dependency
        while (node) {
          if (node._source === this) {
            node._version = this._version;
            found = true;
            break;
          }
          node = node._nextSource;
        }

        // Add new dependency if not found
        if (!found) {
          // Create node inline with minimal overhead
          const newNode: DependencyNode = {
            _source: this,
            _target: current,
            _version: this._version,
            _prevSource: undefined,
            _nextSource: current._sources,
            _prevTarget: undefined,
            _nextTarget: this._targets,
            _rollbackNode: undefined,
          };

          // Link to target's sources
          if (current._sources) {
            current._sources._prevSource = newNode;
          }
          current._sources = newNode;

          // Link to source's targets
          if (this._targets) {
            this._targets._prevTarget = newNode;
          } else {
            // First target - enable tracking
            this._flags |= TRACKING;
          }
          this._targets = newNode;
        }
      }
    }

    // Call refresh and return the value
    this._refresh();
    return this._value;
  },
});

// Add optimized _refresh method based on Preact's approach
Computed.prototype._refresh = function (this: Computed): boolean | any {
  this._flags &= ~NOTIFIED;

  // Fast path: already running (cycle detection)
  if (this._flags & RUNNING) {
    throw new Error('Cycle detected');
  }

  // Fast path: if tracking and not outdated, value is current
  if ((this._flags & (OUTDATED | TRACKING)) === TRACKING) {
    return true;
  }

  this._flags &= ~OUTDATED;

  // Fast path: global version check - this is the diamond optimization!
  // Only skip if we've been computed at least once
  const globalVersion = this._scope?.globalVersion;
  if (this._version > 0 && this._globalVersion === globalVersion) {
    return true;
  }

  this._globalVersion = globalVersion || 0;

  // Mark as running before checking dependencies
  this._flags |= RUNNING;

  // Check if any sources changed
  if (this._version > 0 && !this._needsToRecompute()) {
    this._flags &= ~RUNNING;
    return true;
  }

  // Recompute needed
  const prevComputed = this._scope?.currentComputed;
  if (this._scope) {
    this._scope.currentComputed = this;
  }

  try {
    // Prepare sources for cleanup
    this._prepareSources();

    const value = this._fn();
    if (this._value !== value || this._version === 0) {
      this._value = value;
      this._version++;
    }
  } finally {
    if (this._scope) {
      this._scope.currentComputed = prevComputed;
    }

    // Cleanup unused sources
    this._cleanupSources();

    this._flags &= ~RUNNING;
  }

  return true;
};

// Helper method to check if recomputation is needed
Computed.prototype._needsToRecompute = function (this: Computed): boolean {
  let node = this._sources;
  while (node) {
    const source = node._source;
    // Check if source version changed
    if (node._version !== source._version) {
      // Need to check if source itself needs refresh (for nested computeds)
      if ('_refresh' in source && typeof source._refresh === 'function') {
        // Important: first refresh the source to get its current state
        source._refresh();
        // Then check if the version actually changed
        if (node._version !== source._version) {
          return true;
        }
      } else {
        return true;
      }
    }
    node = node._nextSource;
  }
  return false;
};

// Inline prepareSources for better performance
Computed.prototype._prepareSources = function (this: Computed): void {
  let node = this._sources;
  while (node) {
    node._version = -1; // Mark for potential cleanup
    node = node._nextSource;
  }
};

// Inline cleanupSources for better performance
Computed.prototype._cleanupSources = function (this: Computed): void {
  let node = this._sources;
  let prev: DependencyNode | undefined;

  while (node) {
    const next = node._nextSource;

    if (node._version === -1) {
      // Remove unused node
      if (prev) {
        prev._nextSource = next;
      } else {
        this._sources = next;
      }
      if (next) {
        next._prevSource = prev;
      }

      // Remove from source's targets
      const source = node._source;
      const prevTarget = node._prevTarget;
      const nextTarget = node._nextTarget;

      if (prevTarget) {
        prevTarget._nextTarget = nextTarget;
      } else {
        source._targets = nextTarget;
        // If no more targets and it's a computed, clear tracking flag
        if (!nextTarget && '_flags' in source) {
          source._flags &= ~TRACKING;
        }
      }

      if (nextTarget) {
        nextTarget._prevTarget = prevTarget;
      }
    } else {
      prev = node;
    }

    node = next;
  }
};

// Add methods to the prototype
Computed.prototype._notify = function (this: Computed): void {
  if (!(this._flags & NOTIFIED)) {
    this._flags |= NOTIFIED | OUTDATED;
    // Propagate notification to our targets
    let node = this._targets;
    while (node) {
      node._target._notify();
      node = node._nextTarget;
    }
  }
};

Computed.prototype.dispose = function (this: Computed): void {
  if (!(this._flags & DISPOSED)) {
    this._flags |= DISPOSED;
    this._node?.disposeComputed(this);
    this._value = undefined;
  }
};

// Add subscribe method to prototype (will be overridden by subscribe scope)
Computed.prototype.subscribe = function (
  this: Computed,
  _fn: (value: any) => void
) {
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
