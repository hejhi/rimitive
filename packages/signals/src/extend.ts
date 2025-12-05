/**
 * @lattice/signals/extend - Extension API for custom composition
 *
 * Use this module when you need to:
 * - Create custom signal presets with different helpers
 * - Wire signals with custom schedulers or graph implementations
 * - Build instrumented/debuggable signal variants
 *
 * ## Example: Custom Preset
 * ```typescript
 * import { Signal, Computed, Effect, createHelpers } from '@lattice/signals/extend';
 * import { composeFrom } from '@lattice/lattice';
 *
 * const helpers = createHelpers();
 * const svc = composeFrom({
 *   signal: Signal(),
 *   computed: Computed(),
 *   effect: Effect(),
 * }, helpers);
 * ```
 */

// =============================================================================
// Primitive Factories - For custom composition
// =============================================================================

export { Signal } from './signal';
export { Computed } from './computed';
export { Effect } from './effect';
export { Batch } from './batch';
export { Subscribe } from './subscribe';

// =============================================================================
// Helper Factories - For custom wiring
// =============================================================================

export { createHelpers, defaultExtensions } from './presets/core';
export { createGraphEdges } from './helpers/graph-edges';
export { createGraphTraversal } from './helpers/graph-traversal';
export { createPullPropagator } from './helpers/pull-propagator';
export { createScheduler } from './helpers/scheduler';
export { createUntracked } from './untrack';

// =============================================================================
// Factory Types - For typing custom services
// =============================================================================

export type { SignalFactory, SignalDeps, SignalOptions } from './signal';
export type { ComputedFactory, ComputedDeps, ComputedOptions } from './computed';
export type { EffectFactory, EffectDeps, EffectOptions } from './effect';
export type { BatchFactory, BatchDeps, BatchOptions } from './batch';
export type { SubscribeFactory, SubscribeDeps, SubscribeOptions } from './subscribe';

// =============================================================================
// Helper Types - For custom helper implementations
// =============================================================================

export type { Helpers } from './presets/core';
export type { GraphEdges, Consumer } from './helpers/graph-edges';
export type { GraphTraversal } from './helpers/graph-traversal';
export type { PullPropagator } from './helpers/pull-propagator';
export type { Scheduler } from './helpers/scheduler';

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
