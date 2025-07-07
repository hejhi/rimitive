// Batch implementation for deferred effect execution
import {
  globalBatchDepth,
  startGlobalBatch,
  endGlobalBatch,
  globalBatchedEffects,
  setGlobalBatchedEffects,
} from './signal';

// Direct export instead of factory pattern
export function batch<T>(fn: () => T): T {
  if (globalBatchDepth) return fn();

  startGlobalBatch();
  try {
    return fn();
  } finally {
    if (endGlobalBatch()) {
      // Run batched effects
      let effect = globalBatchedEffects;
      setGlobalBatchedEffects(null);

      while (effect) {
        const next = effect._nextBatchedEffect;
        effect._nextBatchedEffect = undefined;
        effect._run();
        effect = next || null;
      }
    }
  }
}
