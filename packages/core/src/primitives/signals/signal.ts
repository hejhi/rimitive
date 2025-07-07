// Simplified Signal implementation - bare metal

import type { Signal, Computed, Effect } from './types';
import { RUNNING } from './types';
import { acquireNode } from './node-pool';

// Global tracking state - eliminates scope lookup in hot path
export let globalCurrentComputed: Computed | Effect | null = null;
let globalVersion = 0;

// Global batch state - eliminates scope lookup for batching
let globalBatchDepth = 0;
let globalBatchedEffects: Effect | null = null;

// Signal constructor
function SignalImpl<T>(this: Signal<T>, value: T) {
  this._value = value;
  this._version = 0;
  this._targets = undefined;
  this._node = undefined;
}

// Cast to constructor type
const Signal = SignalImpl as unknown as {
  new <T>(value: T): Signal<T>;
  prototype: Signal;
};

// Value property - hot path optimized
Object.defineProperty(Signal.prototype, 'value', {
  get(this: Signal) {
    // Fast path: no tracking needed (eliminated scope lookup)
    if (!globalCurrentComputed || !(globalCurrentComputed._flags & RUNNING))
      return this._value;

    const current = globalCurrentComputed;

    // Node reuse pattern - check if we can reuse existing node
    let node = this._node;
    if (node !== undefined && node.target === current) {
      // Reuse existing node - just update version
      node.version = this._version;
      return this._value;
    }

    // Check if already tracking this signal in current computed
    node = current._sources;
    while (node) {
      if (node.source === this) {
        node.version = this._version;
        return this._value;
      }
      node = node.nextSource;
    }

    // Create new dependency node using pool
    const newNode = acquireNode();
    newNode.source = this;
    newNode.target = current;
    newNode.version = this._version;
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
    }
    this._targets = newNode;

    // Store node for reuse
    this._node = newNode;

    return this._value;
  },

  set(this: Signal, value) {
    if (this._value === value) return;

    this._value = value;
    this._version++;
    globalVersion++;

    // Notify all targets
    let node = this._targets;
    while (node) {
      node.target._notify();
      node = node.nextTarget;
    }
  },
});

// Signals are always fresh
Signal.prototype._refresh = function (): boolean {
  return true;
};

// Placeholder subscribe
Signal.prototype.subscribe = function () {
  return () => {};
};

// Add set method for property updates
Signal.prototype.set = function <T>(this: Signal<T>, key: unknown, value: unknown): void {
  if (Array.isArray(this._value)) {
    // For arrays, create new array with updated element
    const arr = [...this._value];
    const index = key as number;
    arr[index] = value;
    this.value = arr as T;
  } else if (typeof this._value === 'object' && this._value !== null) {
    // For objects, use spread
    const objKey = key as keyof T;
    this.value = { ...this._value, [objKey]: value } as T;
  }
};

// Add patch method for nested partial updates
Signal.prototype.patch = function <T>(this: Signal<T>, key: unknown, partial: unknown): void {
  if (Array.isArray(this._value)) {
    // For arrays, patch element at index
    const arr = [...this._value];
    const index = key as number;
    const current = arr[index];
    arr[index] = typeof current === 'object' && current !== null
      ? { ...current, ...(partial as object) }
      : partial;
    this.value = arr as T;
  } else if (typeof this._value === 'object' && this._value !== null) {
    // For objects, patch property
    const objKey = key as keyof T;
    const current = this._value[objKey];
    this.value = {
      ...this._value,
      [objKey]: typeof current === 'object' && current !== null
        ? { ...current, ...(partial as object) }
        : partial
    } as T;
  }
};

// Select method is added in lattice-integration.ts

export function createScopedSignalFactory() {
  function signal<T>(value: T): Signal<T> {
    const s = new Signal(value);
    return s;
  }

  function writeSignal<T>(signal: Signal<T>, value: T): void {
    signal.value = value;
  }

  function untrack<T>(fn: () => T): T {
    const prev = globalCurrentComputed;
    globalCurrentComputed = null;
    try {
      return fn();
    } finally {
      globalCurrentComputed = prev;
    }
  }

  return { signal, writeSignal, peek, untrack };
}

// Export for use by computed and effect
export function setGlobalCurrentComputed(
  computed: Computed | Effect | null
): void {
  globalCurrentComputed = computed;
}

export function getGlobalVersion(): number {
  return globalVersion;
}

export function incrementGlobalVersion(): void {
  globalVersion++;
}

export function resetGlobalTracking(): void {
  globalCurrentComputed = null;
  globalVersion = 0;
  globalBatchDepth = 0;
  globalBatchedEffects = null;
}

// Batch state exports
export function getGlobalBatchDepth(): number {
  return globalBatchDepth;
}

export function isInBatch(): boolean {
  return globalBatchDepth > 0;
}

export function startGlobalBatch(): void {
  globalBatchDepth++;
}

export function endGlobalBatch(): boolean {
  return --globalBatchDepth === 0;
}

export function getGlobalBatchedEffects(): Effect | null {
  return globalBatchedEffects;
}

export function setGlobalBatchedEffects(effects: Effect | null): void {
  globalBatchedEffects = effects;
}

export function addEffectToBatch(effect: Effect): void {
  effect._nextBatchedEffect = globalBatchedEffects || undefined;
  globalBatchedEffects = effect;
}

export function peek<T>(signal: Signal<T>): T {
  return signal._value;
}
