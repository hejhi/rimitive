import type {
  ServiceContext,
  InstrumentationContext,
  ServiceDefinition,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import { Scheduler } from './helpers/scheduler';

/**
 * ServiceDefinition for the batch primitive.
 * This is what gets composed into a service context.
 */
export type BatchFactory = ServiceDefinition<'batch', <T>(fn: () => T) => T>;

/**
 * The instantiable service returned by Batch().
 *
 * Use this type when building custom service compositions:
 * @example
 * ```ts
 * import { Batch, type BatchService } from '@lattice/signals/batch';
 *
 * const batchService: BatchService = Batch();
 * const factory = batchService.create(deps); // BatchFactory
 * ```
 */
export type BatchService = ReturnType<typeof Batch>;

/**
 * Dependencies required by the Batch factory.
 * These are wired automatically by presets - only needed for custom compositions.
 */
export type BatchDeps = {
  startBatch: Scheduler['startBatch'];
  endBatch: Scheduler['endBatch'];
};

/**
 * Options for customizing Batch behavior.
 * Pass to Batch() when creating a custom service composition.
 */
export type BatchOptions = {
  instrument?: (
    impl: <T>(fn: () => T) => T,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => <T>(fn: () => T) => T;
};

export const Batch = defineService(
  ({ startBatch, endBatch }: BatchDeps) =>
    ({ instrument }: BatchOptions = {}): BatchFactory => {
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
        impl: batch,
        ...(instrument && { instrument }),
      };
    }
);
