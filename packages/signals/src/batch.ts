import type { LatticeExtension } from '@lattice/lattice';
import { Scheduler } from './helpers/scheduler';
import { GlobalContext } from './context';

export type BatchContext = GlobalContext & {
  scheduler: Scheduler;
}

// BatchFactory uses SignalContext which includes all helpers
export function createBatchFactory(
  opts: {
    ctx: GlobalContext,
    startBatch: Scheduler['startBatch'],
    endBatch: Scheduler['endBatch']
  }
): LatticeExtension<'batch', <T>(fn: () => T) => T> {
  const { startBatch, endBatch } = opts;

  // Signal writes propagate immediately during batch.
  // We only defer effect execution to batch end.
  const batch = function batch<T>(fn: () => T): T {
    startBatch();

    try {
      return fn();
    } finally {
      endBatch(); // endBatch automatically flushes when depth reaches 0
    }
  };

  return {
    name: 'batch',
    method: batch,
  };
}
