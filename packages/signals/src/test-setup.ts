// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { SignalInterface } from './signal';
import type { EffectInterface, EffectDisposer } from './effect';
import type { ComputedInterface } from './computed';
import { createContext } from './context';
import { createWorkQueue } from './helpers/work-queue';
import { createGraphWalker } from './helpers/graph-walker';
import { createDependencyHelpers } from './helpers/dependency-tracking';
import { createSourceCleanup } from './helpers/source-cleanup';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createSubscribeFactory } from './subscribe';
import { createContext as createLattice } from '@lattice/lattice';

// Create a test instance
export function createTestInstance() {
  // Create extended context for testing
  const base = createContext();
  const workQueue = createWorkQueue();
  const graphWalker = createGraphWalker();
  const dependencies = createDependencyHelpers();
  const sourceCleanup = createSourceCleanup(dependencies.removeFromTargets);
  const ctx = {
    ...base,
    workQueue,
    graphWalker,
    dependencies,
    sourceCleanup,
  };
  
  // Create API with all core factories
  const api = createLattice(
    createSignalFactory(ctx),
    createComputedFactory(ctx),
    createEffectFactory(ctx),
    createBatchFactory(ctx),
    createSubscribeFactory(ctx)
  );
  
  return {
    // Signal functions
    signal: api.signal,

    // Computed functions
    computed: api.computed,

    // Effect functions
    effect: api.effect,

    // Subscribe function
    subscribe: api.subscribe,

    // Batch functions - now use ctx
    batch: api.batch,
    startBatch: () => ctx.batchDepth++,
    endBatch: () => {
      if (ctx.batchDepth > 0) ctx.batchDepth--;
    },
    getBatchDepth: () => ctx.batchDepth,
    hasPendingEffects: () => ctx.workQueue.state.tail !== ctx.workQueue.state.head,
    clearBatch: () => {
      ctx.workQueue.state.head = 0;
      ctx.workQueue.state.tail = 0;
      // Reset batch depth safely
      ctx.batchDepth = 0;
    },

    // Scope functions - use ctx
    setCurrentConsumer: (consumer: ComputedInterface | EffectInterface | null) => {
      ctx.currentConsumer = consumer;
    },
    getCurrentConsumer: () => ctx.currentConsumer,
    resetGlobalState: () => {
      // Clear any pending scheduled effects
      const count = ctx.workQueue.state.tail - ctx.workQueue.state.head;
      for (let i = 0; i < count; i++) {
        const consumer = ctx.workQueue.state.queue![(ctx.workQueue.state.head + i) & ctx.workQueue.state.mask];
        if (consumer) consumer._nextScheduled = undefined;
      }
      ctx.workQueue.state.head = 0;
      ctx.workQueue.state.tail = 0;

      // Reset context
      ctx.currentConsumer = null;
      ctx.version = 0;
      ctx.batchDepth = 0;
    },
    getGlobalVersion: () => ctx.version,
    activeContext: ctx,
    // Export work queue for test access
    workQueue: ctx.workQueue,
  };
}

// Create default test instance for backward compatibility
let defaultInstance = createTestInstance();

// Export all functions from default instance - use getters to always get current instance
export const signal = <T>(value: T): SignalInterface<T> => defaultInstance.signal(value);
export const computed = <T>(fn: () => T): ComputedInterface<T> =>
  defaultInstance.computed(fn);
export const effect = (fn: () => void | (() => void)): EffectDisposer =>
  defaultInstance.effect(fn);
export const subscribe = (...args: Parameters<typeof defaultInstance.subscribe>) =>
  defaultInstance.subscribe(...args);
export const batch = (...args: Parameters<typeof defaultInstance.batch>) =>
  defaultInstance.batch(...args);
export const startBatch = () => defaultInstance.startBatch();
export const endBatch = () => defaultInstance.endBatch();
export const getBatchDepth = () => defaultInstance.getBatchDepth();
export const hasPendingEffects = () => defaultInstance.hasPendingEffects();
export const clearBatch = () => defaultInstance.clearBatch();
export const setCurrentConsumer = (
  ...args: Parameters<typeof defaultInstance.setCurrentConsumer>
) => defaultInstance.setCurrentConsumer(...args);
export const getCurrentConsumer = () => defaultInstance.getCurrentConsumer();
export const getGlobalVersion = () => defaultInstance.getGlobalVersion();
// Use getter to always get current context
export const activeContext = (() => {
  // Return getter that always gets current context
  const getter = {
    get version() { return defaultInstance.activeContext.version; },
    get batchDepth() { return defaultInstance.activeContext.batchDepth; },
    get scheduledCount() { 
      return defaultInstance.workQueue.state.tail - defaultInstance.workQueue.state.head;
    },
    get scheduledQueue() { 
      return defaultInstance.workQueue.state.queue;
    },
    get currentConsumer() { return defaultInstance.activeContext.currentConsumer; },
    set version(v) { defaultInstance.activeContext.version = v; },
    set batchDepth(v) { defaultInstance.activeContext.batchDepth = v; },
    set scheduledCount(v) { 
      // Reset queue to simulate setting count to v
      defaultInstance.workQueue.state.head = 0;
      defaultInstance.workQueue.state.tail = v;
    },
    set currentConsumer(v) { defaultInstance.activeContext.currentConsumer = v; },
  };
  return getter;
})();

// Reset function that recreates the default instance
export function resetGlobalState() {
  defaultInstance = createTestInstance();
  // CRITICAL: Also reset the actual context
  defaultInstance.resetGlobalState();
}
