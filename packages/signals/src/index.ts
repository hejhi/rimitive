// Tree-shakeable exports - import factories directly
export { createSignalFactory } from './signal';
export { createComputedFactory, createUntrackFactory } from './computed';
export { createEffectFactory } from './effect';
export { createBatchFactory } from './batch';
export { createSubscribeFactory } from './subscribe';
export { createSignalAPI } from './api';

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

// Export Lattice integration types
export type {
  SignalState,
  SetState,
  LatticeContext,
  PartialLatticeContext,
} from './lattice-types';
