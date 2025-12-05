import type {
  ServiceContext,
  InstrumentationContext,
  ServiceDefinition,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import { Scheduler } from './helpers/scheduler';

export type BatchFactory = ServiceDefinition<'batch', <T>(fn: () => T) => T>;

/**
 * Internal dependencies required by the Batch factory.
 * These are wired automatically by presets - users don't need to provide them.
 * @internal
 */
type BatchDeps = {
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
