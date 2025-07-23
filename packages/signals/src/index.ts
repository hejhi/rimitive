// Tree-shakeable exports - import factories directly
export { createSignalFactory } from './signal';
export { createComputedFactory, createUntrackFactory } from './computed';
export { createEffectFactory } from './effect';
export { createBatchFactory } from './batch';
export { createSignalAPI } from './api';

// Convenience exports from default-api (NOT tree-shakeable)
export { signal, computed, effect, batch, untrack, activeContext, coreFactories } from './default-api';

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
  Subscriber,
  Effect,
  Selected,
} from './types';

// Export factory type and helper
export type { SignalFactory, FactoriesToAPI } from './api';

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
