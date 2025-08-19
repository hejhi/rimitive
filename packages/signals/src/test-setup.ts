// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { SignalFunction } from './signal';
import type { EffectDisposer } from './effect';
import type { ComputedFunction } from './computed';
import type { ConsumerNode } from './types';
import { createContext } from './context';
import { createWorkQueue } from './helpers/work-queue';
import { createGraphWalker } from './helpers/graph-walker';
import { createDependencyGraph } from './helpers/dependency-graph';
import { createDependencySweeper } from './helpers/dependency-sweeper';
import { createPropagator } from './helpers/propagator';
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
  const workQueue = createWorkQueue(base);
  const graphWalker = createGraphWalker();
  const propagator = createPropagator();
  const dependencies = createDependencyGraph();
  const sourceCleanup = createDependencySweeper(dependencies.unlink);
  const ctx = {
    ...base,
    workQueue,
    graphWalker,
    propagator,
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
    hasPendingEffects: () => ctx.workQueue.state.size > 0,
    clearBatch: () => {
      ctx.workQueue.state.size = 0;
      // Reset batch depth safely
      ctx.batchDepth = 0;
    },

    // Scope functions - use ctx
    setCurrentConsumer: (consumer: ConsumerNode | null) => {
      ctx.currentConsumer = consumer;
    },
    getCurrentConsumer: () => ctx.currentConsumer,
    resetGlobalState: () => {
      // Clear any pending scheduled effects by walking the intrusive queue
      let node = ctx.queueHead;
      while (node) {
        const next = node._nextScheduled === node ? undefined : node._nextScheduled;
        node._nextScheduled = undefined;
        node = next;
      }
      ctx.queueHead = ctx.queueTail = undefined;
      ctx.workQueue.state.size = 0;

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
export const signal = <T>(value: T): SignalFunction<T> => defaultInstance.signal(value);
export const computed = <T>(fn: () => T): ComputedFunction<T> =>
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
      return defaultInstance.workQueue.state.size;
    },
    get scheduledQueue() { 
      // Materialize the current intrusive queue as an array snapshot
      const out = [];
      let node = defaultInstance.activeContext.queueHead;
      while (node) { 
        out.push(node); 
        node = node._nextScheduled;
      }
      return out;
    },
    get currentConsumer() { return defaultInstance.activeContext.currentConsumer; },
    set version(v) { defaultInstance.activeContext.version = v; },
    set batchDepth(v) { defaultInstance.activeContext.batchDepth = v; },
    set scheduledCount(_v) { 
      // No-op in intrusive queue; kept for backward compat with tests (unused)
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
