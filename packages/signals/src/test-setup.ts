// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { Signal, Computed, Effect, Edge, EffectDisposer } from './types';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createSubscribeFactory } from './subscribe';

// Create a test instance
export function createTestInstance() {
  // Create API with all core factories
  const api = createSignalAPI({
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
    subscribe: createSubscribeFactory,
  });
  
  const ctx = api._ctx;
  
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
    hasPendingEffects: () => ctx.batchedEffects !== null,
    clearBatch: () => {
      ctx.batchedEffects = null;
      // Reset batch depth safely
      ctx.batchDepth = 0;
    },

    // Scope functions - use ctx
    setCurrentConsumer: (consumer: Computed | Effect | null) => {
      ctx.currentConsumer = consumer;
    },
    getCurrentConsumer: () => ctx.currentConsumer,
    resetGlobalState: () => {
      // Clear any pending batched effects
      while (ctx.batchedEffects) {
        const next = ctx.batchedEffects._nextBatchedEffect;
        ctx.batchedEffects._nextBatchedEffect = undefined;
        ctx.batchedEffects = next || null;
      }
      
      // Reset context by reinitializing pool and counters
      ctx.currentConsumer = null;
      ctx.version = 0;
      ctx.batchDepth = 0;
      ctx.batchedEffects = null;
      ctx.poolSize = 100;
      ctx.allocations = 0;
      for (let i = 0; i < 100; i++) {
        ctx.nodePool[i] = {} as Edge;
      }
    },
    getGlobalVersion: () => ctx.version,
    activeContext: ctx,
  };
}

// Create default test instance for backward compatibility
let defaultInstance = createTestInstance();

// Export all functions from default instance - use getters to always get current instance
export const signal = <T>(value: T): Signal<T> => defaultInstance.signal(value);
export const computed = <T>(fn: () => T): Computed<T> =>
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
    get allocations() { return defaultInstance.activeContext.allocations; },
    get poolSize() { return defaultInstance.activeContext.poolSize; },
    get version() { return defaultInstance.activeContext.version; },
    get batchDepth() { return defaultInstance.activeContext.batchDepth; },
    get batchedEffects() { return defaultInstance.activeContext.batchedEffects; },
    get currentConsumer() { return defaultInstance.activeContext.currentConsumer; },
    get nodePool() { return defaultInstance.activeContext.nodePool; },
    set allocations(v) { defaultInstance.activeContext.allocations = v; },
    set poolSize(v) { defaultInstance.activeContext.poolSize = v; },
    set version(v) { defaultInstance.activeContext.version = v; },
    set batchDepth(v) { defaultInstance.activeContext.batchDepth = v; },
    set batchedEffects(v) { defaultInstance.activeContext.batchedEffects = v; },
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
