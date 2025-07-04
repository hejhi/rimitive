// Signal implementation

import type { Signal } from './types';
import { RUNNING } from './types';
import type { SignalScope } from './scope';
import type { BatchScope } from './batch';
import type { NodeScope } from './node';

// Signal constructor function
function SignalImpl<T>(this: Signal<T>, value: T) {
  this._value = value;
  this._version = 0;
  this._targets = undefined;
  this._targetsTail = undefined;
  this._scope = undefined;
  this._batch = undefined;
  this._node = undefined;
}

// Cast to get the right constructor type
const Signal = SignalImpl as unknown as {
  new <T>(value: T): Signal<T>;
  prototype: Signal;
};

// Define the value property on the prototype
Object.defineProperty(Signal.prototype, 'value', {
  get(this: Signal) {
    // Inline dependency tracking for hot path
    const scope = this._scope;
    if (scope) {
      const current = scope.currentComputed;
      if (current && (current._flags & RUNNING)) {
        // Inline addDependency logic
        let node = current._sources;
        let found = false;
        
        // Fast check if already tracking
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
          // Create node inline
          const newNode = {
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
          }
          this._targets = newNode;
        }
      }
    }
    return this._value;
  },
  set(this: Signal, value) {
    // Early exit for no change
    if (this._value === value) {
      return;
    }
    
    // Cache property accesses
    const scope = this._scope;
    const batch = this._batch;
    const node = this._node;
    
    this._value = value;
    this._version++;
    scope?.incrementGlobalVersion();

    // Check batch depth once
    if (!batch?.batchDepth) {
      node?.notifyTargets(this);
    } else {
      // In batch - notify targets (they handle marking as outdated)
      let targetNode = this._targets;
      while (targetNode) {
        targetNode.target._notify();
        targetNode = targetNode.nextTarget;
      }
    }
  }
});

// Add _refresh method for compatibility with computed refresh checks
Signal.prototype._refresh = function(this: Signal): boolean {
  return true; // Signals are always "fresh"
};

// Add subscribe method to prototype (will be overridden by subscribe scope)
Signal.prototype.subscribe = function(this: Signal, _fn: (value: any) => void) {
  return () => {};
};

export function createScopedSignalFactory(
  scope: SignalScope,
  batch: BatchScope,
  node: NodeScope
) {
  function signal<T>(value: T): Signal<T> {
    const s = new Signal(value);
    // Store scope references directly on the signal
    s._scope = scope;
    s._batch = batch;
    s._node = node;
    return s;
  }

  // Direct assignment is now supported via setter
  function writeSignal<T>(signal: Signal<T>, value: T): void {
    signal.value = value;
  }

  function untrack<T>(fn: () => T): T {
    const prev = scope.currentComputed;
    try {
      // Temporarily disable tracking
      scope.currentComputed = null;
      return fn();
    } finally {
      scope.currentComputed = prev;
    }
  }

  return {
    signal,
    writeSignal,
    peek,
    untrack,
  };
}

// Utility functions for signals
export function peek<T>(signal: Signal<T>): T {
  return signal._value;
}
