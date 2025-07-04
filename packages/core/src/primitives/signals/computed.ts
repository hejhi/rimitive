// Simplified Computed implementation - bare metal

import type { Computed, DependencyNode } from './types';
import { NOTIFIED, OUTDATED, RUNNING, DISPOSED, TRACKING, IS_COMPUTED } from './types';
import type { UnifiedScope } from './scope';

// Computed constructor
function ComputedImpl<T>(this: Computed<T>, fn: () => T) {
  this._fn = fn;
  this._value = undefined;
  this._version = 0;
  this._globalVersion = -1;
  this._flags = OUTDATED | IS_COMPUTED;
  this._sources = undefined;
  this._targets = undefined;
  this._node = undefined;
  this._scope = undefined;
}

// Cast to constructor type
const Computed = ComputedImpl as unknown as {
  new <T>(fn: () => T): Computed<T>;
  prototype: Computed;
};

// Value property - hot path optimized
Object.defineProperty(Computed.prototype, 'value', {
  get(this: Computed) {
    if (this._flags & DISPOSED) {
      throw new Error('Computed is disposed');
    }

    const scope = this._scope as UnifiedScope;
    const current = scope?.currentComputed;
    
    // Track this computed as dependency if needed
    if (current && current._flags & RUNNING) {
      // Node reuse pattern - check if we can reuse existing node
      let node = this._node;
      if (node !== undefined && node.target === current) {
        // Reuse existing node - just update version
        node.version = this._version;
      } else {
        // Check if already tracking this computed in current context
        node = current._sources;
        while (node) {
          if (node.source === this) {
            node.version = this._version;
            break;
          }
          node = node.nextSource;
        }
        
        if (!node) {
          // Create new dependency node
          const newNode: DependencyNode = {
            source: this,
            target: current,
            version: this._version,
            nextSource: current._sources,
            nextTarget: this._targets,
          };
          
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
    return this._value;
  },
});

// Simplified refresh - inline everything for performance
Computed.prototype._refresh = function(): boolean {
  this._flags &= ~NOTIFIED;

  if (this._flags & RUNNING) {
    throw new Error('Cycle detected');
  }

  // Fast path: tracking and not outdated
  if ((this._flags & (OUTDATED | TRACKING)) === TRACKING) {
    return true;
  }

  this._flags &= ~OUTDATED;

  // Store global version but don't use it for early exit during computations
  const scope = this._scope as UnifiedScope;
  const globalVersion = scope?.globalVersion || 0;
  
  this._flags |= RUNNING;

  // Check if sources changed
  if (this._version > 0) {
    let needsRecompute = false;
    let node = this._sources;
    
    while (node) {
      const source = node.source;
      // Refresh source if it's a computed
      if (source._refresh) {
        source._refresh();
      }
      // Check if version changed
      if (node.version !== source._version) {
        needsRecompute = true;
        break;
      }
      node = node.nextSource;
    }
    
    if (!needsRecompute) {
      this._flags &= ~RUNNING;
      return true;
    }
  }

  // Recompute
  const prevComputed = scope?.currentComputed;
  if (scope) scope.currentComputed = this;

  try {
    // Mark sources for cleanup
    let node = this._sources;
    while (node) {
      node.version = -1;
      node = node.nextSource;
    }

    const value = this._fn();
    if (this._value !== value || this._version === 0) {
      this._value = value;
      this._version++;
    }
    // Update global version after successful computation
    this._globalVersion = globalVersion;
  } finally {
    if (scope) scope.currentComputed = prevComputed;

    // Cleanup unused sources
    let node = this._sources;
    let prev: DependencyNode | undefined;

    while (node) {
      const next = node.nextSource;

      if (node.version === -1) {
        // Remove unused
        if (prev) {
          prev.nextSource = next;
        } else {
          this._sources = next;
        }
        if (next) {
          next.prevSource = prev;
        }

        // Remove from source's targets
        const source = node.source;
        const prevTarget = node.prevTarget;
        const nextTarget = node.nextTarget;

        if (prevTarget) {
          prevTarget.nextTarget = nextTarget;
        } else {
          source._targets = nextTarget;
          if (!nextTarget && '_flags' in source) {
            source._flags &= ~TRACKING;
          }
        }

        if (nextTarget) {
          nextTarget.prevTarget = prevTarget;
        }
      } else {
        prev = node;
      }

      node = next;
    }

    this._flags &= ~RUNNING;
  }

  return true;
};

// Notify targets
Computed.prototype._notify = function(): void {
  if (!(this._flags & NOTIFIED)) {
    this._flags |= NOTIFIED | OUTDATED;
    
    let node = this._targets;
    while (node) {
      node.target._notify();
      node = node.nextTarget;
    }
  }
};

// Dispose
Computed.prototype.dispose = function(): void {
  if (!(this._flags & DISPOSED)) {
    this._flags |= DISPOSED;
    
    // Clear all sources
    let node = this._sources;
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

      node = next;
    }
    
    this._sources = undefined;
    this._value = undefined;
  }
};

// Placeholder subscribe
Computed.prototype.subscribe = function() {
  return () => {};
};

export type ComputedScope = {
  computed: <T>(fn: () => T) => Computed<T>;
};

export function createComputedScope(scope: UnifiedScope): ComputedScope {
  function computed<T>(fn: () => T): Computed<T> {
    const c = new Computed(fn);
    c._scope = scope;
    return c;
  }

  return { computed };
}