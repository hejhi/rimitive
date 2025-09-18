// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { SignalFunction } from './signal';
// Effect now returns () => void directly
import type { ComputedFunction } from './computed';
import type { ConsumerNode, Dependency } from './types';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createContext as createLattice } from '@lattice/lattice';
import { createBaseContext, GlobalContext } from './context';
import { createGraphEdges, GraphEdges } from './helpers/graph-edges';
import { createPullPropagator, PullPropagator } from './helpers/pull-propagator';
import { createScheduler, Scheduler } from './helpers/scheduler';
import { createGraphTraversal } from './helpers/graph-traversal';

// Create a complete context with all helpers
export function createDefaultContext(): PullPropagator & GraphEdges & Scheduler & {
    ctx: GlobalContext;
    propagate: (subscribers: Dependency) => void;
  } {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();
  const { traverseGraph } = createGraphTraversal();
  const scheduler = createScheduler({ propagate: traverseGraph });
  const pull = createPullPropagator({ ctx, track: graphEdges.track });

  return {
    ctx,
    ...graphEdges,
    ...scheduler,
    ...pull,
  };
}

// Create a test instance with a stable context
export function createTestInstance() {
  const opts = createDefaultContext();
  const { ctx, propagate, startBatch, endBatch } = opts;

  // Create API with all core factories
  const api = createLattice(
    createSignalFactory({ ...opts, propagate }),
    createComputedFactory(opts),
    createEffectFactory(opts),
    createBatchFactory({ ...opts, startBatch, endBatch })
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

    // Context access for testing
    setCurrentConsumer: (consumer: ConsumerNode | null) => {
      ctx.currentConsumer = consumer;
    },
    getCurrentConsumer: () => ctx.currentConsumer,
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