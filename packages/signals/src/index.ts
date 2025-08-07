// ARCHITECTURE: Tree-Shakeable Module Design
//
// This index file exports individual factory functions rather than a
// pre-built API object. This enables dead code elimination:
// - If you only use signals, the computed/effect code is eliminated
// - Each factory is a separate module that can be tree-shaken
// - Users compose their own API with just the primitives they need
//
// Tree-shakeable exports - import factories directly
export { createSignalFactory } from './signal';
export { createComputedFactory } from './computed';
export { createEffectFactory } from './effect';
export { createBatchFactory } from './batch';
export { createSubscribeFactory } from './subscribe';

// Export the work queue for advanced users
export { createWorkQueue } from './helpers/work-queue';
export type { WorkQueue } from './helpers/work-queue';

// Export API creation utilities
export { createSignalAPI } from './api';


// Export types for TypeScript users
// These are just type definitions with no runtime code
export type {
  ReactiveNode,
  Readable,
  Writable,
  Disposable,
  ProducerNode,
  ConsumerNode,
  ScheduledNode,
  Edge,
} from './types';

export type { SignalInterface as Signal } from './signal';
export type { ComputedInterface as Computed } from './computed';
export type { EffectInterface as Effect, EffectCleanup, EffectDisposer, Unsubscribe } from './effect';

// Export API creation types for users building custom primitives
// or extending the reactive system
export type { FactoriesToAPI } from './api';
