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
  type Subscribable,
} from '@lattice/signals';

// Create the default API instance
export const signalAPI = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
  batch: createBatchFactory,
  subscribe: createSubscribeFactory,
});

// Export individual functions for convenience with proper types
export const signal = signalAPI.signal as <T>(value: T) => Signal<T>;
export const computed = signalAPI.computed as <T>(fn: () => T, options?: ComputedOptions) => Computed<T>;
export const effect = signalAPI.effect as (fn: () => EffectCleanup) => Unsubscribe;
export const batch = signalAPI.batch as <T>(fn: () => T) => T;
export const subscribe = signalAPI.subscribe as <T>(source: Subscribable<T> & { _targets?: unknown; _version: number; _refresh(): boolean }, callback: (value: T) => void, options?: { skipEqualityCheck?: boolean }) => Unsubscribe;