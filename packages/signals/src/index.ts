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

// Export Lattice extensions
export { signalExtension } from './extensions/signal';
export { computedExtension } from './extensions/computed';
export { effectExtension } from './extensions/effect';
export { batchExtension } from './extensions/batch';
export { selectExtension } from './extensions/select';
export { subscribeExtension } from './extensions/subscribe';

// Export core extensions bundle for convenience
import { signalExtension } from './extensions/signal';
import { computedExtension } from './extensions/computed';
import { effectExtension } from './extensions/effect';
import { batchExtension } from './extensions/batch';
import { selectExtension } from './extensions/select';
import { subscribeExtension } from './extensions/subscribe';

export const coreExtensions = [
  signalExtension,
  computedExtension,
  effectExtension,
  batchExtension,
  selectExtension,
  subscribeExtension,
] as const;

// Export store-specific types
export type {
  SignalState,
  SetState,
  LatticeContext,
  PartialLatticeContext,
} from './store-types';