import type {
  ServiceContext,
  InstrumentationContext,
  ServiceDefinition,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import { Scheduler } from './deps/scheduler';

/**
 * ServiceDefinition for the batch primitive.
 * This is what gets composed into a service context.
 */
export type BatchFactory = ServiceDefinition<'batch', <T>(fn: () => T) => T>;

/**
 * The instantiable service returned by Batch().
 *
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
 * Wired automatically by presets - only needed for custom compositions.
 * @internal
 */
export type BatchDeps = {
  startBatch: Scheduler['startBatch'];
  endBatch: Scheduler['endBatch'];
};

/**
 * Options for customizing Batch behavior.
 *
 * @example Adding instrumentation
 * ```ts
 * const batchService = Batch({
 *   instrument(impl, instr, ctx) {
 *     return (fn) => {
 *       instr.emit({ type: 'batch:start', timestamp: Date.now(), data: {} });
 *       const result = impl(fn);
 *       instr.emit({ type: 'batch:end', timestamp: Date.now(), data: {} });
 *       return result;
 *     };
 *   },
 * });
 * ```
 */
export type BatchOptions = {
  /** Custom instrumentation wrapper for debugging/profiling */
  instrument?: (
    impl: <T>(fn: () => T) => T,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => <T>(fn: () => T) => T;
};

/**
 * Create a Batch service factory.
 *
 * Batch groups multiple signal writes into a single update cycle,
 * preventing intermediate effect executions.
 *
 * **Most users should use the preset instead:**
 * ```ts
 * import { createSignals } from '@lattice/signals/presets/core';
 * const { batch } = createSignals()();
 * ```
 *
 * @example Avoiding intermediate updates
 * ```ts
 * const { signal, effect, batch } = createSignals()();
 *
 * const a = signal(0);
 * const b = signal(0);
 *
 * effect(() => console.log(a() + b())); // logs: 0
 *
 * // Without batch: logs twice (1, then 3)
 * a(1);
 * b(2);
 *
 * // With batch: logs once (6)
 * batch(() => {
 *   a(2);
 *   b(4);
 * });
 * ```
 *
 * @example Nested batches
 * ```ts
 * batch(() => {
 *   a(1);
 *   batch(() => {
 *     b(2);
 *     c(3);
 *   });
 *   d(4);
 * }); // All updates flush at outermost batch end
 * ```
 *
 * @example With return value
 * ```ts
 * const result = batch(() => {
 *   count(count() + 1);
 *   return count();
 * });
 * console.log(result); // New count value
 * ```
 */
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
