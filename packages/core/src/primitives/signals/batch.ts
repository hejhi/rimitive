// Batching system for effects

import type { Effect } from './types';
import { OUTDATED } from './types';

export type BatchScope = {
  getBatchDepth: () => number;
  batch: <T>(fn: () => T) => T;
  startBatch: () => void;
  endBatch: () => void;
  addToBatch: (effect: Effect) => void;
  hasPendingEffects: () => boolean;
  clearBatch: () => void;
};

export function createBatchScope(): BatchScope {
  let batchDepth = 0;
  let batchedEffects: Effect | null = null;

  function getBatchDepth(): number {
    return batchDepth;
  }

  function batch<T>(fn: () => T): T {
    if (batchDepth > 0) return fn();

    batchDepth++;
    try {
      return fn();
    } finally {
      if (--batchDepth === 0) {
        runBatchedEffects();
      }
    }
  }

  function startBatch(): void {
    batchDepth++;
  }

  function endBatch(): void {
    if (batchDepth > 0 && --batchDepth === 0) {
      runBatchedEffects();
    }
  }

  function addToBatch(effect: Effect): void {
    effect._nextBatchedEffect = batchedEffects ?? undefined;
    batchedEffects = effect;
  }

  function runBatchedEffects(): void {
    let effect = batchedEffects;
    batchedEffects = null;

    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    while (effect && iterations < maxIterations) {
      const next = effect._nextBatchedEffect;
      effect._nextBatchedEffect = undefined;

      if (effect._flags & OUTDATED) {
        effect._run();
      }

      effect = next ?? null;
      iterations++;
    }

    if (iterations >= maxIterations) {
      throw new Error('Batch effect limit exceeded - possible infinite loop');
    }
  }

  // For testing
  function hasPendingEffects(): boolean {
    return batchedEffects !== null;
  }

  function clearBatch(): void {
    batchedEffects = null;
    batchDepth = 0;
  }

  return {
    getBatchDepth,
    batch,
    startBatch,
    endBatch,
    addToBatch,
    hasPendingEffects,
    clearBatch,
  };
}
