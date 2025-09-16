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
import type { LatticeExtension } from '@lattice/lattice';
import { NodeScheduler } from './helpers/node-scheduler';
import { GlobalContext } from './context';

export type BatchContext = GlobalContext & {
  nodeScheduler: NodeScheduler;
}

// BatchFactory uses SignalContext which includes all helpers
export function createBatchFactory(
  opts: {
    ctx: GlobalContext,
    nodeScheduler: NodeScheduler
  }
): LatticeExtension<'batch', <T>(fn: () => T) => T> {
  const { startBatch, endBatch } = opts.nodeScheduler;

  // Signal writes propagate immediately during batch.
  // We only defer effect execution to batch end.
  const batch = function batch<T>(fn: () => T): T {
    const isNewBatch = startBatch();

    try {
      return fn();
    } finally {
      // End batch and auto-flush if it was the outermost batch
      if (isNewBatch) endBatch();
    }
  };

  return {
    name: 'batch',
    method: batch,
  };
}
