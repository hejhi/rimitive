// Batch implementation with factory pattern for performance
import type { SignalContext } from './context';
import { ScheduledConsumer } from './types';
import type { LatticeExtension } from '@lattice/lattice';

export function createBatchFactory(ctx: SignalContext): LatticeExtension<'batch', <T>(fn: () => T) => T> {
  const batch = function batch<T>(fn: () => T): T {
    if (ctx.batchDepth) return fn();

    ctx.batchDepth++;
    try {
      return fn();
    } finally {
      if (--ctx.batchDepth === 0) {
        // Process scheduled items
        let scheduled = ctx.scheduled;
        ctx.scheduled = null;
        while (scheduled) {
          const next: ScheduledConsumer | null = scheduled._nextScheduled || null;
          scheduled._nextScheduled = undefined;
          scheduled._flush();
          scheduled = next;
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

  return {
    name: 'batch',
    method: batch
  };
}