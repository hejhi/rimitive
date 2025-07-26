// Default signal API instance for React hooks
import {
  createSignalAPI,
  createSignalFactory,
  createComputedFactory,
  createEffectFactory,
  createBatchFactory,
  createSubscribeFactory,
  type Signal,
  type Computed,
  type ComputedOptions,
  type EffectCleanup,
  type Unsubscribe,
} from '@lattice/signals';

// Create the default API instance
export const signalAPI = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
  batch: createBatchFactory,
  subscribe: createSubscribeFactory,
});

// Export individual functions for convenience with explicit types
export const signal: <T>(value: T) => Signal<T> = signalAPI.signal;
export const computed: <T>(fn: () => T, options?: ComputedOptions) => Computed<T> = signalAPI.computed;
export const effect: (fn: () => EffectCleanup) => Unsubscribe = signalAPI.effect;
export const batch: <T>(fn: () => T) => T = signalAPI.batch;
// Use typeof to get the actual type from the API
export const subscribe: typeof signalAPI.subscribe = signalAPI.subscribe;