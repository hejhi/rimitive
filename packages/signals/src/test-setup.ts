// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { Signal, Computed, Effect } from './types';
import { createComputedScope } from './computed';
import { createEffectScope } from './effect';
import { createBatchScope } from './batch';
import {
  createScopedSignalFactory,
  setGlobalCurrentComputed,
  globalCurrentComputed,
  globalVersion,
  resetGlobalTracking,
  globalBatchDepth,
  startGlobalBatch,
  endGlobalBatch,
  globalBatchedEffects,
  setGlobalBatchedEffects,
} from './signal';
import { resetNodePool } from './node-pool';

// Create a test instance
export function createTestInstance() {
  const {
    signal: createSignal,
    writeSignal,
    peek,
    untrack,
  } = createScopedSignalFactory();
  const { effect: createEffect } = createEffectScope();
  const { computed: createComputed } = createComputedScope();
  const { batch } = createBatchScope();

  return {
    // Signal functions
    signal: createSignal,
    writeSignal,
    peek,
    untrack,

    // Computed functions
    computed: createComputed,

    // Effect functions
    effect: createEffect,

    // Batch functions - now use global state
    batch,
    startBatch: () => startGlobalBatch(),
    endBatch: () => {
      if (globalBatchDepth > 0) endGlobalBatch();
    },
    getBatchDepth: () => globalBatchDepth,
    hasPendingEffects: () => globalBatchedEffects !== null,
    clearBatch: () => {
      setGlobalBatchedEffects(null);
      // Reset batch depth safely
      while (globalBatchDepth > 0) {
        endGlobalBatch();
      }
    },

    // Scope functions - use global functions
    setCurrentComputed: (computed: Computed | Effect | null) => {
      setGlobalCurrentComputed(computed);
    },
    getCurrentComputed: () => globalCurrentComputed,
    resetGlobalState: () => {
      resetGlobalTracking();
    },
    getGlobalVersion: () => globalVersion,
  };
}

// Create default test instance for backward compatibility
let defaultInstance = createTestInstance();

// Export all functions from default instance - use getters to always get current instance
export const signal = <T>(value: T): Signal<T> => defaultInstance.signal(value);
export const writeSignal = <T>(signal: Signal<T>, value: T): void =>
  defaultInstance.writeSignal(signal, value);
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
  // CRITICAL: Also reset the actual global variables
  resetGlobalTracking();
  // Reset the node pool for test isolation
  resetNodePool();
}
