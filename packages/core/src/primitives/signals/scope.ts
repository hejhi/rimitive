// Unified scope for signals - combining all state management

import type { Computed, Effect } from './types';
import { setGlobalCurrentComputed, incrementGlobalVersion, getGlobalVersion, getGlobalCurrentComputed } from './signal';

export interface UnifiedScope {
  // Global state
  globalVersion: number;
  currentComputed: Computed | Effect | null; // Keep for compatibility, but sync with global

  // Batching state
  batchDepth: number;
  batchedEffects: Effect | null;

  // Methods
  batch<T>(fn: () => T): T;
}

export function createUnifiedScope(): UnifiedScope {
  // Run batched effects
  function runEffects(): void {
    let effect = scope.batchedEffects;
    scope.batchedEffects = null;

    while (effect) {
      const next = effect._nextBatchedEffect;
      effect._nextBatchedEffect = undefined;
      effect._run();
      effect = next || null;
    }
  }

  const scope: UnifiedScope = {
    // Global state
    get globalVersion() {
      // Return the actual global version
      return getGlobalVersion();
    },
    set globalVersion(value) {
      // When scope tries to increment version, increment the global one
      if (value > 0) {
        incrementGlobalVersion();
      }
    },
    get currentComputed() {
      // Return the actual global current computed
      return getGlobalCurrentComputed();
    },
    set currentComputed(value) {
      // Sync with global state when set
      setGlobalCurrentComputed(value);
    },
    
    // Batching state
    batchDepth: 0,
    batchedEffects: null,

    // Methods
    batch<T>(fn: () => T): T {
      if (scope.batchDepth > 0) return fn();

      scope.batchDepth++;
      try {
        return fn();
      } finally {
        if (--scope.batchDepth === 0) {
          runEffects();
        }
      }
    },
  };

  return scope;
}
