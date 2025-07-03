// Batching system for effects

import type { Effect } from './types';
import { OUTDATED } from './types';

export type BatchScope = {
  // Direct property access for hot path performance
  batchDepth: number;
  batchedEffects: Effect | null;
  
  // Methods
  batch: <T>(fn: () => T) => T;
  startBatch: () => void;
  endBatch: () => void;
  addToBatch: (effect: Effect) => void;
  hasPendingEffects: () => boolean;
  clearBatch: () => void;
};

export function createBatchScope(): BatchScope {
  const scope: BatchScope = {
    // Initialize properties
    batchDepth: 0,
    batchedEffects: null,
  } as BatchScope;
  
  function runBatchedEffects(): void {
    let effect = scope.batchedEffects;
    scope.batchedEffects = null;

    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    while (effect && iterations < maxIterations) {
      const next = effect._nextBatchedEffect;
      effect._nextBatchedEffect = undefined;

      if (effect._flags & OUTDATED) {
        effect._run();
      }

      effect = next || null;
      iterations++;
    }

    if (iterations >= maxIterations) {
      throw new Error('Batch effect limit exceeded - possible infinite loop');
    }
  }
  
  scope.batch = function<T>(fn: () => T): T {
      if (scope.batchDepth > 0) return fn();

      scope.batchDepth++;
      try {
        return fn();
      } finally {
        if (--scope.batchDepth === 0) {
          runBatchedEffects();
        }
      }
    };

    scope.startBatch = function(): void {
      scope.batchDepth++;
    };

    scope.endBatch = function(): void {
      if (scope.batchDepth > 0 && --scope.batchDepth === 0) {
        runBatchedEffects();
      }
    };

    scope.addToBatch = function(effect: Effect): void {
      effect._nextBatchedEffect = scope.batchedEffects || undefined;
      scope.batchedEffects = effect;
    };

    // For testing
    scope.hasPendingEffects = function(): boolean {
      return scope.batchedEffects !== null;
    };

    scope.clearBatch = function(): void {
      scope.batchedEffects = null;
      scope.batchDepth = 0;
    };

  return scope;
}
