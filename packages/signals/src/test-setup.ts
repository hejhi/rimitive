// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { SignalFunction } from './signal';
// Effect now returns () => void directly
import type { ComputedFunction } from './computed';
import type { ConsumerNode } from './types';
import { Signal } from './signal';
import { Subscribe, SubscribeCallback } from './subscribe';
import { Computed } from './computed';
import { Effect } from './effect';
import { Batch } from './batch';
import { createContext as createLattice } from '@lattice/lattice';
import { createBaseContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createScheduler } from './helpers/scheduler';
import { createGraphTraversal } from './helpers/graph-traversal';

// Create a complete context with all helpers
export function createDefaultContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const _scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const { withPropagate, ...scheduler } = _scheduler;
  const pull = createPullPropagator({ track: graphEdges.track });

  return {
    ctx,
    propagate: withPropagate(withVisitor),
    ...graphEdges,
    ...scheduler,
    ...pull,
  };
}

// Create a test instance with a stable context
export function createTestInstance() {
  const opts = createDefaultContext();
  const { ctx, propagate, startBatch, endBatch } = opts;

  // Create extensions
  const signalExt = Signal().create({ ...opts, propagate });
  const computedExt = Computed().create(opts);
  const effectExt = Effect().create(opts);
  const batchExt = Batch().create({ ...opts, startBatch, endBatch });
  const subscribeExt = Subscribe().create(opts);

  // Create API with all core factories
  const api = createLattice(
    signalExt,
    computedExt,
    effectExt,
    batchExt,
    subscribeExt
  );

  // Reset function for test cleanup
  const resetGlobalState = () => {
    ctx.consumerScope = null;
    // Can't reset batch from outside anymore - tests should use endBatch
  };

  return {
    // Core API
    signal: api.signal,
    computed: api.computed,
    effect: api.effect,
    batch: api.batch,
    subscribe: api.subscribe,

    // Context access for testing
    setCurrentConsumer: (consumer: ConsumerNode | null) => {
      ctx.consumerScope = consumer;
    },
    getCurrentConsumer: () => ctx.consumerScope,
    resetGlobalState,

    // Raw access for advanced testing
    activeContext: ctx,
  };
}

// Create default test instance for backward compatibility
const defaultInstance = createTestInstance();

// Export all functions from default instance
export const signal = <T>(value: T): SignalFunction<T> =>
  defaultInstance.signal(value);

export const computed = <T>(fn: () => T): ComputedFunction<T> =>
  defaultInstance.computed(fn);

export const effect = (fn: () => void | (() => void)): (() => void) =>
  defaultInstance.effect(fn);

export const batch = <T>(fn: () => T): T =>
  defaultInstance.batch(fn);

export const subscribe = <T>(fn: () => T, cb: SubscribeCallback<T>): (() => void) =>
  defaultInstance.subscribe(fn, cb);

// Context control exports
export const setCurrentConsumer = (consumer: ConsumerNode | null) =>
  defaultInstance.setCurrentConsumer(consumer);
export const getCurrentConsumer = () =>
  defaultInstance.getCurrentConsumer();

// Global state reset
export function resetGlobalState() {
  defaultInstance.resetGlobalState();
}

// Export the context with getters for backward compatibility
export const activeContext = {
  get consumerScope() {
    return defaultInstance.activeContext.consumerScope;
  },
  set consumerScope(v: ConsumerNode | null) {
    defaultInstance.activeContext.consumerScope = v;
  },
};

// Export the instance itself for tests that need direct access
export { defaultInstance };