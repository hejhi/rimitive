import type { ExtensionContext, InstrumentationContext, LatticeExtension } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import { Scheduler } from './helpers/scheduler';
import { GlobalContext } from './context';

export type BatchContext = GlobalContext & {
  scheduler: Scheduler;
}

export type BatchFactory = LatticeExtension<'batch', <T>(fn: () => T) => T>;

export type BatchOpts = {
  ctx: GlobalContext;
  startBatch: Scheduler['startBatch'];
  endBatch: Scheduler['endBatch'];
}

export type BatchProps = {
  instrument?: (
    method: <T>(fn: () => T) => T,
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => <T>(fn: () => T) => T;
}; 

// BatchFactory uses SignalContext which includes all helpers
export const Batch = create(
  ({ startBatch, endBatch }: BatchOpts) =>
    (props?: BatchProps): BatchFactory => {
      const { instrument } = props ?? {};

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
        ...(instrument && { instrument }),
      };
    }
);
