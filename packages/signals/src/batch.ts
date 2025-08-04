// ALGORITHM: Transaction-Style Batching for Consistent Updates
//
// Batching prevents effects from seeing intermediate states when multiple
// signals change together. Without batching, each signal change would
// immediately trigger effects, potentially causing:
// - Performance issues (redundant computations)
// - Logic bugs (effects seeing inconsistent state)
// - UI flicker (multiple renders for one logical change)
//
// The batch function creates a "transaction" where all changes are collected
// and effects only run once at the end with the final state.
import type { SignalContext } from './context';
import type { LatticeExtension } from '@lattice/lattice';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';

export function createBatchFactory(ctx: SignalContext): LatticeExtension<'batch', <T>(fn: () => T) => T> {
  const { flushScheduled } = createScheduledConsumerHelpers(ctx);
  
  // ALGORITHM: Nested Batch Support
  // The batch function is reentrant - batches can be nested safely.
  // Only the outermost batch triggers the flush.
  const batch = function batch<T>(fn: () => T): T {
    // OPTIMIZATION: Fast Path for Nested Batches
    // If we're already in a batch, just run the function
    // The outer batch will handle the flush
    if (ctx.batchDepth) return fn();

    // ALGORITHM: Batch Depth Tracking
    // Increment depth to signal we're in a batch
    // This causes signal.value setters to schedule effects instead of running them
    ctx.batchDepth++;
    
    try {
      // Execute the user's function
      // Any signal changes inside will be batched
      return fn();
    } finally {
      // ALGORITHM: Conditional Flush on Batch Exit
      // Decrement depth and check if we're exiting the outermost batch
      // Only flush when depth reaches 0 (no more nested batches)
      if (--ctx.batchDepth === 0) {
        // Execute all effects that were scheduled during the batch
        // They'll see the final state of all signal changes
        flushScheduled();
      }
      // FIXME: What if flushScheduled throws? Should we reset batchDepth to 0?
      // Currently, a throwing effect could leave batchDepth in an invalid state
    }
  };

  return {
    name: 'batch',
    method: batch
  };
}