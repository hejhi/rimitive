// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { Signal, Computed, Effect } from './types';
import { computed as createComputed } from './computed';
import { effect as effectFn } from './effect';
import { batch as batchFn } from './batch';
import {
  signal as createSignal,
  peek as peekFn,
  untrack as untrackFn,
  activeContext,
  resetTracking,
} from './signal';
import { resetNodePool } from './node-pool';

// Create a test instance
export function createTestInstance() {

  return {
    // Signal functions
    signal: createSignal,
    peek: peekFn,
    untrack: untrackFn,

    // Computed functions
    computed: createComputed,

    // Effect functions
    effect: effectFn,

    // Batch functions - now use activeContext
    batch: batchFn,
    startBatch: () => activeContext.batchDepth++,
    endBatch: () => {
      if (activeContext.batchDepth > 0) activeContext.batchDepth--;
    },
    getBatchDepth: () => activeContext.batchDepth,
    hasPendingEffects: () => activeContext.batchedEffects !== null,
    clearBatch: () => {
      activeContext.batchedEffects = null;
      // Reset batch depth safely
      activeContext.batchDepth = 0;
    },

    // Scope functions - use activeContext
    setCurrentComputed: (computed: Computed | Effect | null) => {
      activeContext.currentComputed = computed;
    },
    getCurrentComputed: () => activeContext.currentComputed,
    resetGlobalState: () => {
      resetTracking();
    },
    getGlobalVersion: () => activeContext.version,
  };
}

// Create default test instance for backward compatibility
let defaultInstance = createTestInstance();

// Export all functions from default instance - use getters to always get current instance
export const signal = <T>(value: T): Signal<T> => defaultInstance.signal(value);
export const peek = <T>(signal: Signal<T>): T => defaultInstance.peek(signal);
export const untrack = <T>(fn: () => T): T => defaultInstance.untrack(fn);
export const computed = <T>(fn: () => T): Computed<T> =>
  defaultInstance.computed(fn);
export const effect = (fn: () => void): (() => void) =>
  defaultInstance.effect(fn);
export const batch = (...args: Parameters<typeof defaultInstance.batch>) =>
  defaultInstance.batch(...args);
export const startBatch = () => defaultInstance.startBatch();
export const endBatch = () => defaultInstance.endBatch();
export const getBatchDepth = () => defaultInstance.getBatchDepth();
export const hasPendingEffects = () => defaultInstance.hasPendingEffects();
export const clearBatch = () => defaultInstance.clearBatch();
export const setCurrentComputed = (
  ...args: Parameters<typeof defaultInstance.setCurrentComputed>
) => defaultInstance.setCurrentComputed(...args);
export const getCurrentComputed = () => defaultInstance.getCurrentComputed();
export const getGlobalVersion = () => defaultInstance.getGlobalVersion();

// Reset function that recreates the default instance
export function resetGlobalState() {
  defaultInstance = createTestInstance();
  // CRITICAL: Also reset the actual context
  resetTracking();
  // Reset the node pool for test isolation
  resetNodePool();
}
