// Full-featured signal package with all utilities
export { signal } from './signal';
export { computed } from './computed';
export { effect } from './effect';
export { batch } from './batch';

// Standalone helper functions
export { subscribe } from './subscribe-standalone';
export { select } from './select-standalone';

// Re-export type guards
export { isSignal, isComputed, isEffect, isReactive, isEffectDisposer, getEffectFromDisposer } from './type-guards';

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
  Selected,
} from './types';