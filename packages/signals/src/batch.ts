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
import type { SignalContext } from './context';

// Removed: Error wrapping adds unnecessary overhead
// Let non-Error values throw naturally

// BatchFactory uses SignalContext which includes all helpers
export function createBatchFactory(ctx: SignalContext): LatticeExtension<'batch', <T>(fn: () => T) => T> {
  const { flush } = ctx.nodeScheduler;
  const { checkStale } = ctx.pullPropagator;

  // OPTIMIZATION: Immediate propagation strategy like Alien Signals
  // Signal writes now propagate immediately during batch
  // We only defer effect execution to batch end
  const batch = function batch<T>(fn: () => T): T {
    // Fast path: if already batching, just run the function
    if (ctx.batchDepth > 0) return fn();
    
    // Start batch
    ctx.batchDepth++;
    
    // Execute user function with simple error handling
    try {
      return fn();
    } finally {
      // Always decrement and flush effects if outermost batch
      // Only flush queued effects - propagation already happened
      if (--ctx.batchDepth === 0) flush(checkStale);
    }
  };

  return {
    name: 'batch',
    method: batch
  };
}
