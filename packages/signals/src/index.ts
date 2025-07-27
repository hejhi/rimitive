// Tree-shakeable exports - import factories directly
export { createSignalFactory } from './signal';
export { createComputedFactory } from './computed';
export { createEffectFactory } from './effect';
export { createBatchFactory } from './batch';
export { createSubscribeFactory } from './subscribe';
export { createSignalAPI } from './api';


// Export types
export type {
  BaseReactive,
  Node,
  Producer,
  Consumer,
  Edge,
  ScheduledConsumer,
} from './types';

export type { SignalInterface as Signal } from './signal';
export type { ComputedInterface as Computed } from './computed';
export type { EffectInterface as Effect, EffectCleanup, EffectDisposer, Unsubscribe } from './effect';

// Export factory type and helper
export type { FactoriesToAPI } from './api';
