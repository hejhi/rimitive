/**
 * ALGORITHM: Transaction-Style Batching for Consistent Updates
 * 
 * Batching is a critical optimization that groups multiple reactive updates
 * into a single "transaction". This solves several problems:
 * 
 * 1. CONSISTENCY PROBLEM (The Diamond Problem):
 *    Without batching:
 *    ```
 *    const width = signal(10);
 *    const height = signal(20);
 *    const area = computed(() => width.value * height.value);
 *    effect(() => console.log(area.value));
 *    
 *    // Without batching:
 *    width.value = 5;   // effect logs 100 (5 * 20) - WRONG!
 *    height.value = 10; // effect logs 50 (5 * 10) - correct
 *    ```
 *    The effect sees an intermediate state where only width changed.
 * 
 * 2. PERFORMANCE PROBLEM:
 *    - Effects run once per signal change without batching
 *    - With N signal changes, effects run N times
 *    - With batching, effects run exactly once
 * 
 * 3. UI CONSISTENCY:
 *    - Prevents UI flicker from multiple renders
 *    - Similar to React's automatic batching in event handlers
 *    - Ensures users see atomic updates
 * 
 * ALGORITHM DETAILS:
 * - Uses a depth counter for nested batch support
 * - Effects are queued, not executed, during a batch
 * - Queue is flushed when outermost batch completes
 * - Inspired by database transactions and React's batching
 */
import type { SignalContext } from './context';
import type { LatticeExtension } from '@lattice/lattice';
import { createWorkQueue } from './helpers/work-queue';

// PATTERN: Error Wrapper for Non-Error Values
// When user code throws non-Error values (strings, numbers, etc.),
// we need to wrap them to satisfy ESLint's only-throw-error rule
// while preserving the original value for error handling.
class BatchError extends Error {
  constructor(message: string, public originalError: unknown) {
    super(message);
    this.name = 'BatchError';
  }
}

export function createBatchFactory(ctx: SignalContext): LatticeExtension<'batch', <T>(fn: () => T) => T> {
  const workQueue = createWorkQueue(ctx);
  
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
    
    // ALGORITHM: Error-Safe Batch Execution
    // We need to ensure batchDepth is properly managed even if errors occur.
    // Track all errors that occur during execution.
    let userError: unknown;
    let flushError: unknown;
    let result: T;
    
    try {
      // Execute the user's function
      // Any signal changes inside will be batched
      result = fn();
    } catch (error) {
      // Capture user code error
      userError = error;
    }
    
    // ALGORITHM: Guaranteed Batch Depth Management  
    // Always decrement depth, even if user code threw
    const shouldFlush = --ctx.batchDepth === 0;
    
    if (shouldFlush) {
      try {
        // Execute all effects that were scheduled during the batch
        // They'll see the final state of all signal changes
        workQueue.flush();
      } catch (error) {
        // CRITICAL: Reset batchDepth on flush error
        // This prevents the system from getting stuck in a batched state
        ctx.batchDepth = 0;
        flushError = error;
      }
    }
    
    // ALGORITHM: Error Priority Handling
    // Handle errors after all cleanup is complete
    if (userError && flushError) {
      // Both errors occurred - log the flush error and throw user error
      // User error takes priority as it happened first and is likely the root cause
      console.error('Error during batch flush (after user error):', flushError);
      // Wrap non-Error values to satisfy ESLint
      if (userError instanceof Error) {
        throw userError;
      } else {
        throw new BatchError('Batch function threw a non-Error value', userError);
      }
    } else if (userError) {
      // Only user error
      if (userError instanceof Error) {
        throw userError;
      } else {
        throw new BatchError('Batch function threw a non-Error value', userError);
      }
    } else if (flushError) {
      // Only flush error
      if (flushError instanceof Error) {
        throw flushError;
      } else {
        throw new BatchError('Batch flush threw a non-Error value', flushError);
      }
    }
    
    // No errors - return the result
    return result!;
  };

  return {
    name: 'batch',
    method: batch
  };
}