// Simplified Signal implementation - bare metal

import type { Signal, DependencyNode } from './types';
import { RUNNING } from './types';
import type { UnifiedScope } from './scope';

// Signal constructor
function SignalImpl<T>(this: Signal<T>, value: T) {
  this._value = value;
  this._version = 0;
  this._targets = undefined;
  this._scope = undefined;
}

// Cast to constructor type
const Signal = SignalImpl as unknown as {
  new <T>(value: T): Signal<T>;
  prototype: Signal;
};

// Value property - hot path optimized
Object.defineProperty(Signal.prototype, 'value', {
  get(this: Signal) {
    const scope = this._scope as UnifiedScope;
    const current = scope?.currentComputed;
    
    // Fast path: no tracking needed
    if (!current || !(current._flags & RUNNING)) {
      return this._value;
    }
    
    // Check if already tracking
    let node = current._sources;
    while (node) {
      if (node.source === this) {
        node.version = this._version;
        return this._value;
      }
      node = node.nextSource;
    }
    
    // Add new dependency - inline for performance
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
    }
    this._targets = newNode;
    
    return this._value;
  },
  
  set(this: Signal, value) {
    if (this._value === value) return;
    
    this._value = value;
    this._version++;
    
    const scope = this._scope as UnifiedScope;
    if (scope) {
      scope.globalVersion++;
      
      // Notify all targets
      let node = this._targets;
      while (node) {
        node.target._notify();
        node = node.nextTarget;
      }
    }
  }
});

// Signals are always fresh
Signal.prototype._refresh = function(): boolean {
  return true;
};

// Placeholder subscribe
Signal.prototype.subscribe = function() {
  return () => {};
};

export function createScopedSignalFactory(scope: UnifiedScope) {
  function signal<T>(value: T): Signal<T> {
    const s = new Signal(value);
    s._scope = scope;
    return s;
  }

  function writeSignal<T>(signal: Signal<T>, value: T): void {
    signal.value = value;
  }

  function untrack<T>(fn: () => T): T {
    const prev = scope.currentComputed;
    scope.currentComputed = null;
    try {
      return fn();
    } finally {
      scope.currentComputed = prev;
    }
  }

  return { signal, writeSignal, peek, untrack };
}

export function peek<T>(signal: Signal<T>): T {
  return signal._value;
}