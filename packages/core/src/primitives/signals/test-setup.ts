// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { Computed, Effect } from './types';
import { createBatchScope } from './batch';
import { createComputedScope } from './computed';
import { createEffectScope } from './effect';
import { createNodeScope } from './node';
import { createSignalScope } from './scope';
import { createScopedSignalFactory } from './signal';

// Create a test instance
export function createTestInstance() {
  const scope = createSignalScope();
  const batch = createBatchScope();
  const node = createNodeScope();
  const { signal: createSignal, writeSignal, peek, untrack } = createScopedSignalFactory(
    scope,
    batch,
    node
  );
  const { effect: createEffect } = createEffectScope(scope, batch, node);
  const { computed: createComputed } = createComputedScope(scope, node);

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
    batch: batch.batch,
    startBatch: batch.startBatch,
    endBatch: batch.endBatch,
    getBatchDepth: () => batch.batchDepth,
    hasPendingEffects: batch.hasPendingEffects,
    clearBatch: batch.clearBatch,
    
    // Node functions
    acquireNode: node.acquireNode,
    releaseNode: node.releaseNode,
    addDependency: node.addDependency,
    prepareSources: node.prepareSources,
    cleanupSources: node.cleanupSources,
    disposeComputed: node.disposeComputed,
    notifyTargets: node.notifyTargets,
    getPoolSize: node.getPoolSize,
    clearPool: node.clearPool,
    
    // Scope functions
    setCurrentComputed: (computed: Computed | Effect | null) => { scope.currentComputed = computed; },
    getCurrentComputed: () => scope.currentComputed,
    resetGlobalState: scope.resetGlobalState,
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
export const acquireNode = defaultInstance.acquireNode;
export const releaseNode = defaultInstance.releaseNode;
export const addDependency = defaultInstance.addDependency;
export const prepareSources = defaultInstance.prepareSources;
export const cleanupSources = defaultInstance.cleanupSources;
export const disposeComputed = defaultInstance.disposeComputed;
export const notifyTargets = defaultInstance.notifyTargets;
export const getPoolSize = defaultInstance.getPoolSize;
export const clearPool = defaultInstance.clearPool;
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
    acquireNode: defaultInstance.acquireNode,
    releaseNode: defaultInstance.releaseNode,
    addDependency: defaultInstance.addDependency,
    prepareSources: defaultInstance.prepareSources,
    cleanupSources: defaultInstance.cleanupSources,
    disposeComputed: defaultInstance.disposeComputed,
    notifyTargets: defaultInstance.notifyTargets,
    getPoolSize: defaultInstance.getPoolSize,
    clearPool: defaultInstance.clearPool,
    setCurrentComputed: defaultInstance.setCurrentComputed,
    getCurrentComputed: defaultInstance.getCurrentComputed,
    getGlobalVersion: defaultInstance.getGlobalVersion,
  });
}