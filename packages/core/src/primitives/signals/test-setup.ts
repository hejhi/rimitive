// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { Computed, Effect } from './types';
import { createUnifiedScope } from './scope';
import { createComputedScope } from './computed';
import { createEffectScope } from './effect';
import { createScopedSignalFactory } from './signal';

// Create a test instance
export function createTestInstance() {
  const scope = createUnifiedScope();
  const { signal: createSignal, writeSignal, peek, untrack } = createScopedSignalFactory(scope);
  const { effect: createEffect } = createEffectScope(scope);
  const { computed: createComputed } = createComputedScope(scope);

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
    
    // Batch functions
    batch: (fn: () => void) => scope.batch(fn),
    startBatch: () => scope.batchDepth++,
    endBatch: () => { if (scope.batchDepth > 0) scope.batchDepth--; },
    getBatchDepth: () => scope.batchDepth,
    hasPendingEffects: () => scope.batchedEffects !== null,
    clearBatch: () => { scope.batchedEffects = null; scope.batchDepth = 0; },
    
    // Scope functions
    setCurrentComputed: (computed: Computed | Effect | null) => { scope.currentComputed = computed; },
    getCurrentComputed: () => scope.currentComputed,
    resetGlobalState: () => { scope.globalVersion = 0; scope.currentComputed = null; },
    getGlobalVersion: () => scope.globalVersion,
  };
}

// Create default test instance for backward compatibility
let defaultInstance = createTestInstance();

// Export all functions from default instance
export const signal = defaultInstance.signal;
export const writeSignal = defaultInstance.writeSignal;
export const peek = defaultInstance.peek;
export const untrack = defaultInstance.untrack;
export const computed = defaultInstance.computed;
export const effect = defaultInstance.effect;
export const batch = defaultInstance.batch;
export const startBatch = defaultInstance.startBatch;
export const endBatch = defaultInstance.endBatch;
export const getBatchDepth = () => defaultInstance.getBatchDepth();
export const hasPendingEffects = defaultInstance.hasPendingEffects;
export const clearBatch = defaultInstance.clearBatch;
export const setCurrentComputed = defaultInstance.setCurrentComputed;
export const getCurrentComputed = defaultInstance.getCurrentComputed;
export const getGlobalVersion = defaultInstance.getGlobalVersion;

// Reset function that recreates the default instance
export function resetGlobalState() {
  defaultInstance = createTestInstance();
  
  // Re-bind all exports
  Object.assign(exports, {
    signal: defaultInstance.signal,
    writeSignal: defaultInstance.writeSignal,
    peek: defaultInstance.peek,
    untrack: defaultInstance.untrack,
    computed: defaultInstance.computed,
    effect: defaultInstance.effect,
    batch: defaultInstance.batch,
    startBatch: defaultInstance.startBatch,
    endBatch: defaultInstance.endBatch,
    getBatchDepth: () => defaultInstance.getBatchDepth(),
    hasPendingEffects: defaultInstance.hasPendingEffects,
    clearBatch: defaultInstance.clearBatch,
    setCurrentComputed: defaultInstance.setCurrentComputed,
    getCurrentComputed: defaultInstance.getCurrentComputed,
    getGlobalVersion: defaultInstance.getGlobalVersion,
  });
}