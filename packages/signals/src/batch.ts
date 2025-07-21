// Batch implementation for deferred effect execution
import { activeContext } from './context';

// Direct export instead of factory pattern
export function batch<T>(fn: () => T): T {
  if (activeContext.batchDepth) return fn();

  activeContext.batchDepth++;
  try {
    return fn();
  } finally {
    if (--activeContext.batchDepth === 0) {
      // Run batched effects
      let effect = activeContext.batchedEffects;
      activeContext.batchedEffects = null;

      while (effect) {
        const next = effect._nextBatchedEffect;
        effect._nextBatchedEffect = undefined;
        effect._run();
        effect = next || null;
      }
    }
  }
}
