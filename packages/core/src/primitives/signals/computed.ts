// Simplified Computed implementation - bare metal

import type { Computed, DependencyNode } from './types';
import { NOTIFIED, OUTDATED, RUNNING, DISPOSED, TRACKING, IS_COMPUTED } from './types';
import type { UnifiedScope } from './scope';
import { setGlobalCurrentComputed, getGlobalCurrentComputed, getGlobalVersion } from './signal';

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

    const current = getGlobalCurrentComputed();
    
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

// Helper: Prepare sources for re-evaluation
function prepareSources(computed: Computed): void {
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
function cleanupSources(computed: Computed): void {
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
    } else {
      // This node was re-used, keep it
      prev = node;
    }
    
    node = next;
  }
}

// Check if recomputation is needed
function needsToRecompute(computed: Computed): boolean {
  // Check dependencies in order of use
  for (
    let node = computed._sources;
    node !== undefined;
    node = node.nextSource
  ) {
    const source = node.source;
    
    // Three checks as in Preact:
    // 1. Version already changed (fast path)
    if (node.version !== source._version) {
      return true;
    }
    
    // 2. Try to refresh the source (handles nested computeds)
    if (!source._refresh()) {
      return true;
    }
    
    // 3. Check if version changed after refresh
    if (node.version !== source._version) {
      return true;
    }
  }
  
  return false;
}

// Simplified refresh - inline everything for performance
Computed.prototype._refresh = function(): boolean {
  this._flags &= ~NOTIFIED;

  if (this._flags & RUNNING) {
    throw new Error('Cycle detected');
  }

  // CRITICAL OPTIMIZATION: Check global version FIRST before any other work
  // This is the most important optimization for diamond patterns
  const globalVersion = getGlobalVersion();
  
  // Only use global version optimization if we're not outdated
  if (!(this._flags & OUTDATED) && this._version > 0 && this._globalVersion === globalVersion) {
    return true;
  }

  // Fast path: tracking and not outdated
  if ((this._flags & (OUTDATED | TRACKING)) === TRACKING) {
    return true;
  }
  
  this._flags &= ~OUTDATED;

  // Mark as running before checking dependencies
  this._flags |= RUNNING;
  
  // Check if we actually need to recompute
  if (this._version > 0 && !needsToRecompute(this)) {
    this._flags &= ~RUNNING;
    return true;
  }

  // Recompute needed
  const prevComputed = getGlobalCurrentComputed();
  try {
    prepareSources(this);
    setGlobalCurrentComputed(this);
    
    const value = this._fn();
    if (this._value !== value || this._version === 0) {
      this._value = value;
      this._version++;
    }
    
    // Update global version after successful computation
    this._globalVersion = globalVersion;
  } finally {
    setGlobalCurrentComputed(prevComputed);
    cleanupSources(this);
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