// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { SignalContext, SignalFunction } from './signal';
import type { EffectContext, EffectDisposer } from './effect';
import type { ComputedContext, ComputedFunction } from './computed';
import type { ConsumerNode } from './types';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createContext as createLattice } from '@lattice/lattice';
import { createBaseContext, GlobalContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createNodeScheduler } from './helpers/node-scheduler';
import { createPushPropagator } from './helpers/push-propagator';

export function createDefaultContext(): GlobalContext & SignalContext & EffectContext & ComputedContext {
  const baseCtx = createBaseContext();

  // Create helpers with their dependencies
  const graphEdges = createGraphEdges();
  const pullPropagator = createPullPropagator();
  
  // Extend the base context in place instead of creating a new object
  const ctx = Object.assign(baseCtx, {
    graphEdges,
    pushPropagator: null as unknown as typeof pushPropagator, // Will be set below
    pullPropagator,
    nodeScheduler: null as unknown as typeof nodeScheduler, // Will be set below
  });
  
  // Now create nodeScheduler with the same ctx object
  const nodeScheduler = createNodeScheduler(ctx);
  const pushPropagator = createPushPropagator();
  
  // Set the properties
  ctx.nodeScheduler = nodeScheduler;
  ctx.pushPropagator = pushPropagator;

  return ctx;
}

// Create a test instance with a stable context
export function createTestInstance() {
  // Create extended context for testing - this will be reused
  const ctx = createDefaultContext();
  
  // Store original reset function
  const resetContext = () => {
    // Clear any pending scheduled effects by walking the intrusive queue
    let node = ctx.queueHead;
    while (node) {
      const next = node.nextScheduled === node ? undefined : node.nextScheduled;
      node.nextScheduled = undefined;
      node = next;
    }
    ctx.queueHead = ctx.queueTail = undefined;

    // Reset context state
    ctx.currentConsumer = null;
    ctx.batchDepth = 0;
  };
  
  // Create API with all core factories - these capture the ctx in their closures
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
    resetGlobalState: resetContext,
    activeContext: ctx,
    // Export node scheduler for test access
    nodeScheduler: ctx.nodeScheduler,
  };
}

// Create default test instance for backward compatibility
const defaultInstance = createTestInstance();

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
        node = node.nextScheduled;
      }
      return count;
    },
    get scheduledQueue() { 
      // Materialize the current intrusive queue as an array snapshot
      const out = [];
      let node = defaultInstance.activeContext.queueHead;
      while (node) { 
        out.push(node); 
        node = node.nextScheduled;
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

// Reset function that resets the context without recreating the instance
export function resetGlobalState() {
  // Just reset the context state, don't create a new instance
  // This preserves the context that the factories are bound to
  defaultInstance.resetGlobalState();
}
