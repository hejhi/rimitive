/**
 * Instrumentation wrapper for batch primitives
 */

import type { InstrumentationContext } from '@lattice/lattice';

/**
 * Instrument a batch factory to emit events
 */
export function instrumentBatch(
  impl: <T>(fn: () => T) => T,
  instrumentation: InstrumentationContext
) {
  return function instrumentedBatch<T>(fn: () => T): T {
    const batchId = crypto.randomUUID();

    instrumentation.emit({
      type: 'BATCH_START',
      timestamp: Date.now(),
      data: {
        batchId,
      },
    });

    try {
      const result = impl(fn);

      instrumentation.emit({
        type: 'BATCH_END',
        timestamp: Date.now(),
        data: {
          batchId,
        },
      });

      return result;
    } catch (error) {
      instrumentation.emit({
        type: 'BATCH_ERROR',
        timestamp: Date.now(),
        data: {
          batchId,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  };
}
