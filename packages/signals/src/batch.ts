import type { InstrumentationContext } from '@lattice/lattice';
import { defineModule } from '@lattice/lattice';
import { SchedulerModule, type Scheduler } from './deps/scheduler';

/**
 * The batch function type - groups multiple signal writes into a single update cycle.
 */
export type BatchFactory = <T>(fn: () => T) => T;

/**
 * Batch module - groups multiple signal writes into a single update cycle.
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
export const BatchModule = defineModule({
  name: 'batch',
  dependencies: [SchedulerModule],
  create: ({ scheduler }: { scheduler: Scheduler }): BatchFactory => {
    // Signal writes propagate immediately during batch.
    // We only defer effect execution to batch end.
    return function batch<T>(fn: () => T): T {
      scheduler.startBatch();

      try {
        return fn();
      } finally {
        scheduler.endBatch(); // endBatch automatically flushes when depth reaches 0
      }
    };
  },
  instrument: (impl: BatchFactory, instr: InstrumentationContext): BatchFactory => {
    return <T>(fn: () => T): T => {
      instr.emit({ type: 'batch:start', timestamp: Date.now(), data: {} });
      const result = impl(fn);
      instr.emit({ type: 'batch:end', timestamp: Date.now(), data: {} });
      return result;
    };
  },
});
