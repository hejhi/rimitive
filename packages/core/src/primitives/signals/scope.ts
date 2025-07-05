// Unified scope for signals - combining all state management

import type { Computed, Effect } from './types';

export interface UnifiedScope {
  // Global state
  globalVersion: number;
  currentComputed: Computed | Effect | null;

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
    globalVersion: 0,
    currentComputed: null,
    
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
