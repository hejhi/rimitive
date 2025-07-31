// Batch implementation with factory pattern for performance
import type { SignalContext } from './context';
import type { LatticeExtension } from '@lattice/lattice';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';

export function createBatchFactory(ctx: SignalContext): LatticeExtension<'batch', <T>(fn: () => T) => T> {
  const { flushScheduled } = createScheduledConsumerHelpers(ctx);
  
  const batch = function batch<T>(fn: () => T): T {
    if (ctx.batchDepth) return fn();

    ctx.batchDepth++;
    try {
      return fn();
    } finally {
      if (--ctx.batchDepth === 0) {
        flushScheduled();
      }
    }
  };

  return {
    name: 'batch',
    method: batch
  };
}