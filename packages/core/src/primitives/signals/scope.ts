// Unified scope for signals - combining all state management
import {
  getGlobalBatchDepth,
  startGlobalBatch,
  endGlobalBatch,
  getGlobalBatchedEffects,
  setGlobalBatchedEffects
} from './signal';

export interface UnifiedScope {
  // Methods only - all state is global now
  batch<T>(fn: () => T): T;
}

export function createUnifiedScope(): UnifiedScope {
  // Run batched effects - now uses global state
  function runEffects(): void {
    let effect = getGlobalBatchedEffects();
    setGlobalBatchedEffects(null);

    while (effect) {
      const next = effect._nextBatchedEffect;
      effect._nextBatchedEffect = undefined;
      effect._run();
      effect = next || null;
    }
  }

  const scope: UnifiedScope = {
    // Methods
    batch<T>(fn: () => T): T {
      if (getGlobalBatchDepth() > 0) return fn();

      startGlobalBatch();
      try {
        return fn();
      } finally {
        if (endGlobalBatch()) {
          runEffects();
        }
      }
    },
  };

  return scope;
}
