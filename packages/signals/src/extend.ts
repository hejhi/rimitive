/**
 * @rimitive/signals/extend - Extension API for custom composition
 *
 * Use this module when you need to:
 * - Create custom signal compositions with different deps
 * - Wire signals with custom schedulers or graph implementations
 * - Build instrumented/debuggable signal variants
 */

// =============================================================================
// Modules - For custom composition with defineModule
// =============================================================================

export { SignalModule, createSignalFactory } from './signal';
export { ComputedModule } from './computed';
export { EffectModule } from './effect';
export { IterModule, createIterFactory } from './iter';
export { mt, raf, debounce } from './strategies';
export { BatchModule } from './batch';
export { SubscribeModule, createSubscribeFactory } from './subscribe';
export { UntrackModule, createUntracked } from './untrack';

// =============================================================================
// Dependency Modules - For custom wiring
// =============================================================================

export { GraphEdgesModule, createGraphEdges } from './deps/graph-edges';
export {
  GraphTraversalModule,
  createGraphTraversal,
} from './deps/graph-traversal';
export {
  PullPropagatorModule,
  createPullPropagator,
} from './deps/pull-propagator';
export { SchedulerModule, createScheduler } from './deps/scheduler';

// =============================================================================
// Factory Types - For typing custom services
// =============================================================================

export type { SignalFactory, SignalDeps } from './signal';
export type { ComputedFactory, ComputedDeps } from './computed';
export type { EffectFactory, EffectDeps, FlushStrategy } from './effect';
export type { BatchFactory } from './batch';
export type { SubscribeFunction, SubscribeDeps } from './subscribe';
export type { IterFactory, IterDeps, Iter, IterNode } from './iter';
export { reconcile, type ReconcileCallbacks } from './reconcile';

// =============================================================================
// Helper Types - For custom helper implementations
// =============================================================================

export type { GraphEdges, Consumer } from './deps/graph-edges';
export type { GraphTraversal } from './deps/graph-traversal';
export type { PullPropagator } from './deps/pull-propagator';
export type { Scheduler } from './deps/scheduler';

// =============================================================================
// Graph Types - For advanced reactive graph manipulation
// =============================================================================

export type {
  ReactiveNode,
  ProducerNode,
  ConsumerNode,
  DerivedNode,
  ScheduledNode,
  Dependency,
} from './types';
