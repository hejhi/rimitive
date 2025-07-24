// Batch implementation with factory pattern for performance
import type { SignalContext } from './context';
import { Effect } from './types';

export function createBatchFactory(ctx: SignalContext) {
  return function batch<T>(fn: () => T): T {
    if (ctx.batchDepth) return fn();

    ctx.batchDepth++;
    try {
      return fn();
    } finally {
      if (--ctx.batchDepth === 0) {
        // Process batched effects
        let effect = ctx.batchedEffects;
        ctx.batchedEffects = null;
        while (effect) {
          const next: Effect | null = effect._nextBatchedEffect || null;
          effect._nextBatchedEffect = undefined;
          effect._run();
          effect = next;
        }
        
        // Process batched subscribes
        if (ctx.subscribeBatch && ctx.subscribeBatch.size > 0) {
          const batch = ctx.subscribeBatch;
          ctx.subscribeBatch = undefined;
          for (const subscribe of batch) {
            subscribe._execute();
          }
        }
      }
    }
  };
}