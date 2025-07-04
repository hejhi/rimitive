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
  this._lastRefreshGeneration = 0;
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
      if (current && (current._flags & RUNNING)) {
        // Inline addDependency logic for hot path
        let node = current._sources;
        let found = false;
        
        // Fast check if we already track this dependency
        while (node) {
          if (node.source === this) {
            node.version = this._version;
            found = true;
            break;
          }
          node = node.nextSource;
        }
        
        // Add new dependency if not found
        if (!found) {
          // Create node inline with minimal overhead
          const newNode: DependencyNode = {
            source: this,
            target: current,
            version: this._version,
            prevSource: undefined,
            nextSource: current._sources,
            prevTarget: undefined,
            nextTarget: this._targets,
            rollbackNode: undefined,
          };
          
          // Link to target's sources
          if (current._sources) {
            current._sources.prevSource = newNode;
          }
          current._sources = newNode;
          
          // Link to source's targets
          if (this._targets) {
            this._targets.prevTarget = newNode;
          } else {
            // First target - enable tracking
            this._flags |= TRACKING;
          }
          this._targets = newNode;
        }
      }
    }
    
    // Start refresh cycle for diamond optimization
    const needsCycleStart = scope && scope.refreshGeneration === 0;
    if (needsCycleStart) {
      scope.startRefreshCycle();
    }
    
    try {
      // Optimized refresh logic based on Preact's approach
      return this._refresh();
    } finally {
      // End refresh cycle if we started it
      if (needsCycleStart && scope) {
        scope.endRefreshCycle();
      }
    }
  }
});

// Add optimized _refresh method based on Preact's approach
Computed.prototype._refresh = function(this: Computed): boolean | any {
  const scope = this._scope;
  
  // Check if we've already been refreshed in this generation
  if (scope && scope.refreshGeneration > 0 && this._lastRefreshGeneration === scope.refreshGeneration) {
    return this._value;
  }
  
  this._flags &= ~NOTIFIED;
  
  // Fast path: already running (cycle detection)
  if (this._flags & RUNNING) {
    throw new Error('Cycle detected');
  }
  
  // Fast path: if tracking and not outdated, value is current
  if ((this._flags & (OUTDATED | TRACKING)) === TRACKING) {
    this._lastRefreshGeneration = scope?.refreshGeneration || 0;
    return this._value;
  }
  
  this._flags &= ~OUTDATED;
  
  // Fast path: global version check
  const globalVersion = scope?.globalVersion;
  if (globalVersion !== undefined && this._globalVersion === globalVersion) {
    this._lastRefreshGeneration = scope?.refreshGeneration || 0;
    return this._value;
  }
  
  this._globalVersion = globalVersion || 0;
  
  // Mark as running before checking dependencies
  this._flags |= RUNNING;
  
  // Check if any sources changed
  if (this._version > 0 && !this._needsToRecompute()) {
    this._flags &= ~RUNNING;
    this._lastRefreshGeneration = scope?.refreshGeneration || 0;
    return this._value;
  }
  
  // Recompute needed
  const prevComputed = scope?.currentComputed;
  if (scope) {
    scope.currentComputed = this;
  }
  
  try {
    // Prepare sources for cleanup
    this._prepareSources();
    
    const value = this._fn();
    if (this._value !== value || this._version === 0) {
      this._value = value;
      this._version++;
    }
    
    this._lastRefreshGeneration = scope?.refreshGeneration || 0;
  } finally {
    if (scope) {
      scope.currentComputed = prevComputed;
    }
    
    // Cleanup unused sources
    this._cleanupSources();
    
    this._flags &= ~RUNNING;
  }
  
  return this._value;
};

// Helper method to check if recomputation is needed
Computed.prototype._needsToRecompute = function(this: Computed): boolean {
  let node = this._sources;
  while (node) {
    const source = node.source;
    // Check if source version changed
    if (node.version !== source._version) {
      // Need to check if source itself needs refresh (for nested computeds)
      if ('_refresh' in source && typeof source._refresh === 'function') {
        // The source's _refresh will handle caching internally
        if (!source._refresh() || node.version !== source._version) {
          return true;
        }
      } else {
        return true;
      }
    }
    node = node.nextSource;
  }
  return false;
};

// Inline prepareSources for better performance
Computed.prototype._prepareSources = function(this: Computed): void {
  let node = this._sources;
  while (node) {
    node.version = -1; // Mark for potential cleanup
    node = node.nextSource;
  }
};

// Inline cleanupSources for better performance
Computed.prototype._cleanupSources = function(this: Computed): void {
  let node = this._sources;
  let prev: DependencyNode | undefined;
  
  while (node) {
    const next = node.nextSource;
    
    if (node.version === -1) {
      // Remove unused node
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
        // If no more targets and it's a computed, clear tracking flag
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
};

// Add methods to the prototype
Computed.prototype._notify = function(this: Computed): void {
  if (!(this._flags & NOTIFIED)) {
    this._flags |= NOTIFIED | OUTDATED;
    // Propagate notification to our targets
    let node = this._targets;
    while (node) {
      node.target._notify();
      node = node.nextTarget;
    }
  }
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
