// Tree-shakeable exports - import factories directly
export { createSignalFactory } from './signal';
export { createComputedFactory } from './computed';
export { createEffectFactory } from './effect';
export { createBatchFactory } from './batch';
export { createSubscribeFactory } from './subscribe';
export { createSignalAPI } from './api';

// Re-export type guards
export { isSignal, isComputed, isEffect, isReactive, isNode, isEffectDisposer, getEffectFromDisposer } from './type-guards';

// Export types
export type {
  BaseReactive,
  Signal,
  EffectCleanup,
  EffectDisposer,
  Unsubscribe,
  Effect,
  Node,
  Producer,
  Consumer,
  Edge,
} from './types';

// Export factory type and helper
export type { FactoriesToAPI } from './api';
