// Default signal API instance for React hooks
import {
  createSignalAPI,
  createSignalFactory,
  createComputedFactory,
  createEffectFactory,
  createBatchFactory,
  createSubscribeFactory,
} from '@lattice/signals';

// Create the default API instance
export const signalAPI = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
  batch: createBatchFactory,
  subscribe: createSubscribeFactory,
});

// Export individual functions for convenience
export const signal = signalAPI.signal;
export const computed = signalAPI.computed;
export const effect = signalAPI.effect;
export const batch = signalAPI.batch;
export const subscribe = signalAPI.subscribe;