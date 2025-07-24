// Tree-shakeable exports - import factories directly
export { createSignalFactory } from './signal';
export { createComputedFactory, createUntrackFactory } from './computed';
export { createEffectFactory } from './effect';
export { createBatchFactory } from './batch';
export { createSubscribeFactory } from './subscribe';
export { createSignalAPI } from './api';

// Standalone helper functions

// Re-export type guards
export { isSignal, isComputed, isEffect, isReactive, isSubscribable, isEffectDisposer, getEffectFromDisposer } from './type-guards';

// Export types
export type {
  Signal,
  Computed,
  ComputedOptions,
  EffectCleanup,
  EffectDisposer,
  Unsubscribe,
  Subscriber,
  Effect,
  Subscribable,
} from './types';

// Export factory type and helper
export type { SignalFactory, FactoriesToAPI } from './api';

// Default API for convenience (not tree-shakeable when used)
// Create a shared instance for all convenience exports
import { createSignalFactory } from './signal';
import { createComputedFactory, createUntrackFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createSubscribeFactory } from './subscribe';
import { createSignalAPI } from './api';

const defaultAPI = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
  batch: createBatchFactory,
  untrack: createUntrackFactory,
  subscribe: createSubscribeFactory,
});

// Export convenience functions
export const signal = defaultAPI.signal;
export const computed = defaultAPI.computed;
export const effect = defaultAPI.effect;
export const batch = defaultAPI.batch;
export const untrack = defaultAPI.untrack;
export const subscribe = defaultAPI.subscribe;

// Export Lattice extensions
export { signalExtension } from './extensions/signal';
export { computedExtension } from './extensions/computed';
export { effectExtension } from './extensions/effect';
export { batchExtension } from './extensions/batch';
export { subscribeExtension } from './extensions/subscribe';

// Export core extensions bundle for convenience
import { signalExtension } from './extensions/signal';
import { computedExtension } from './extensions/computed';
import { effectExtension } from './extensions/effect';
import { batchExtension } from './extensions/batch';
import { subscribeExtension } from './extensions/subscribe';

export const coreExtensions = [
  signalExtension,
  computedExtension,
  effectExtension,
  batchExtension,
  subscribeExtension,
] as const;

// Export Lattice integration types
export type {
  SignalState,
  SetState,
  LatticeContext,
  PartialLatticeContext,
} from './lattice-types';
