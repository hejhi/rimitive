// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { SignalFunction } from './signal';
// Effect now returns () => void directly
import type { ComputedFunction } from './computed';
import type { ConsumerNode } from './types';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createContext as createLattice } from '@lattice/lattice';
import { createBaseContext, GlobalContext } from './context';
import { createGraphEdges, GraphEdges } from './helpers/graph-edges';
import { createPullPropagator, PullPropagator } from './helpers/pull-propagator';
import { createNodeScheduler, NodeScheduler } from './helpers/node-scheduler';
import { createPushPropagator, PushPropagator } from './helpers/push-propagator';

// Create a complete context with all helpers
export function createDefaultContext(): {
  ctx: GlobalContext,
  graphEdges: GraphEdges,
  nodeScheduler: NodeScheduler,
  push: PushPropagator,
  pull: PullPropagator
} {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();
  const nodeScheduler = createNodeScheduler();
  const push = createPushPropagator();
  const pull = createPullPropagator(ctx, graphEdges);

  return {
    ctx,
    graphEdges,
    nodeScheduler,
    push,
    pull
  };
}

// Create a test instance with a stable context
export function createTestInstance() {
  const opts = createDefaultContext();
  const { ctx, nodeScheduler } = opts;

  // Create API with all core factories
  const api = createLattice(
    createSignalFactory(opts),
    createComputedFactory(opts),
    createEffectFactory(opts),
    createBatchFactory(opts)
  );

  // Reset function for test cleanup
  const resetGlobalState = () => {
    ctx.currentConsumer = null;
    // Can't reset batch from outside anymore - tests should use endBatch
  };

  return {
    // Core API
    signal: api.signal,
    computed: api.computed,
    effect: api.effect,
    batch: api.batch,

    // Batch control
    enterBatch: nodeScheduler.enterBatch,
    exitBatch: nodeScheduler.exitBatch,

    // Context access for testing
    setCurrentConsumer: (consumer: ConsumerNode | null) => {
      ctx.currentConsumer = consumer;
    },
    getCurrentConsumer: () => ctx.currentConsumer,
    resetGlobalState,

    // Raw access for advanced testing
    activeContext: ctx,
    nodeScheduler,
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

// Batch control exports
export const enterBatch = () => defaultInstance.enterBatch();
export const exitBatch = () => defaultInstance.exitBatch();

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
  get currentConsumer() {
    return defaultInstance.activeContext.currentConsumer;
  },
  set currentConsumer(v: ConsumerNode | null) {
    defaultInstance.activeContext.currentConsumer = v;
  },
};

// Export the instance itself for tests that need direct access
export { defaultInstance };