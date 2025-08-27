// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { SignalFunction } from './signal';
import type { EffectDisposer } from './effect';
import type { ComputedFunction } from './computed';
import type { ConsumerNode } from './types';
import { createContext } from './context';
import { createWorkQueue } from './helpers/work-queue';
import { createDependencyGraph } from './helpers/dependency-graph';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createContext as createLattice } from '@lattice/lattice';

// Create a test instance
export function createTestInstance() {
  // Create extended context for testing
  const base = createContext();
  const workQueue = createWorkQueue(base);
  const graph = createDependencyGraph();
  const ctx = {
    ...base,
    workQueue,
    graph,
  };
  
  // Create API with all core factories
  const api = createLattice(
    createSignalFactory(ctx),
    createComputedFactory(ctx),
    createEffectFactory(ctx),
    createBatchFactory(ctx),
  );
  
  return {
    // Signal functions
    signal: api.signal,

    // Computed functions
    computed: api.computed,

    // Effect functions
    effect: api.effect,

    // Batch functions - now use ctx
    batch: api.batch,
    startBatch: () => ctx.batchDepth++,
    endBatch: () => {
      if (ctx.batchDepth > 0) ctx.batchDepth--;
    },
    getBatchDepth: () => ctx.batchDepth,
    hasPendingEffects: () => ctx.queueHead !== undefined,
    clearBatch: () => {
      // Clear queue
      ctx.queueHead = ctx.queueTail = undefined;
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

      // Reset context
      ctx.currentConsumer = null;
      ctx.batchDepth = 0;
    },
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
// Use getter to always get current context
export const activeContext = (() => {
  // Return getter that always gets current context
  const getter = {
    get batchDepth() { return defaultInstance.activeContext.batchDepth; },
    get scheduledCount() { 
      // Count nodes in queue
      let count = 0;
      let node = defaultInstance.activeContext.queueHead;
      while (node) {
        count++;
        node = node._nextScheduled;
      }
      return count;
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
