// Batching system for effects

import type { Effect } from './types';
import { OUTDATED } from './types';

let batchDepth = 0;
let batchedEffects: Effect | null = null;

export function getBatchDepth(): number {
  return batchDepth;
}

export function batch<T>(fn: () => T): T {
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

export function startBatch(): void {
  batchDepth++;
}

export function endBatch(): void {
  if (batchDepth > 0 && --batchDepth === 0) {
    runBatchedEffects();
  }
}

export function addToBatch(effect: Effect): void {
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
export function hasPendingEffects(): boolean {
  return batchedEffects !== null;
}

export function clearBatch(): void {
  batchedEffects = null;
  batchDepth = 0;
}
