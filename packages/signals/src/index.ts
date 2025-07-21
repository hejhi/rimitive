// Global signal instances for direct usage
import { signal as createSignal, Signal as SignalConstructor } from './signal';
import { effect } from './effect';
import {
  computed as createComputed,
  Computed as ComputedConstructor,
} from './computed';
import { createSubscribeScope } from './subscribe';
import { createSelectFactory } from './select';
import { batch } from './batch';
import type { Signal, Computed } from './types';

const { subscribe } = createSubscribeScope(effect);
const createSelect = createSelectFactory(subscribe);

// Add all methods to Signal prototype - done once at module load
SignalConstructor.prototype.subscribe = function (listener: () => void) {
  return subscribe(this, listener);
};

SignalConstructor.prototype.select = function <T, R>(
  this: Signal<T>,
  selector: (value: T) => R
) {
  return createSelect(this, selector);
};

// Add subscribe and select to Computed prototype - done once at module load
ComputedConstructor.prototype.subscribe = function (listener: () => void) {
  return subscribe(this, listener);
};

ComputedConstructor.prototype.select = function <T, R>(
  this: Computed<T>,
  selector: (value: T) => R
) {
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

// Re-export other utilities
export { effect, subscribe };
export { createSelectFactory, type Selected } from './select';

// Export types
export type {
  Signal,
  Computed,
  ComputedOptions,
  EffectCleanup,
  EffectDisposer,
  Unsubscribe,
  SignalFactory,
  Subscriber,
  Effect,
} from './types';
