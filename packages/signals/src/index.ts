// Global signal instances for direct usage
import { createScopedSignalFactory, Signal as SignalConstructor } from './signal';
import { createEffectScope } from './effect';
import { createComputedScope, Computed as ComputedConstructor } from './computed';
import { createSubscribeScope } from './subscribe';
import { createSelectFactory } from './select';
import { createBatchScope } from './batch';
import type { Signal, Computed, WritableSignal } from './types';

// Create the factories
const { signal: createSignal } = createScopedSignalFactory();
const { effect: createEffect } = createEffectScope();
const { computed: createComputed } = createComputedScope();
const { batch } = createBatchScope();

// Create effect wrapper that handles cleanup
function effect(effectFn: () => void | (() => void)): () => void {
  let cleanupFn: (() => void) | void;

  // Create wrapped effect that handles cleanup
  const dispose = createEffect(() => {
    // Run previous cleanup if exists
    if (cleanupFn) cleanupFn();

    // Run effect and capture new cleanup
    cleanupFn = effectFn();
  });

  // Return dispose function that also runs final cleanup
  return () => {
    dispose();
    if (cleanupFn) cleanupFn();
  };
}

const { subscribe } = createSubscribeScope(effect);
const createSelect = createSelectFactory(createComputed, subscribe);

// Add all methods to Signal prototype - done once at module load
SignalConstructor.prototype.subscribe = function(listener: () => void) {
  return subscribe(this, listener);
};

SignalConstructor.prototype.select = function<T, R>(this: Signal<T>, selector: (value: T) => R) {
  return createSelect(this, selector);
};

SignalConstructor.prototype.set = function <T>(this: Signal<T>, key: unknown, value: unknown): void {
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

SignalConstructor.prototype.patch = function <T>(this: Signal<T>, key: unknown, partial: unknown): void {
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

// Add subscribe and select to Computed prototype - done once at module load
ComputedConstructor.prototype.subscribe = function(listener: () => void) {
  return subscribe(this, listener);
};

ComputedConstructor.prototype.select = function<T, R>(this: Computed<T>, selector: (value: T) => R) {
  return createSelect(this, selector);
};

// Simple signal factory - no per-instance overhead
export function signal<T>(initialValue: T): Signal<T> {
  return createSignal(initialValue);
}

// Simple computed factory - no per-instance overhead
export function computed<T>(computeFn: () => T): Computed<T> {
  return createComputed(computeFn);
}

// Export batch
export { batch };

// Export set function for updating signals
export function set<T>(signal: Signal<T> | WritableSignal<T>, value: T): void {
  (signal as WritableSignal<T>).value = value;
}

// Re-export other utilities
export { effect, subscribe };
export { createSelectFactory, type Selected } from './select';

// Export types
export type { 
  Signal, 
  Computed,
  WritableSignal,
  ComputedOptions,
  EffectCleanup,
  Unsubscribe,
  SignalFactory,
  Subscriber
} from './types';