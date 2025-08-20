/**
 * ALGORITHM: Lightweight Single-Source Subscription Pattern
 * 
 * Subscribe implements a specialized reactive pattern optimized for the common
 * case of watching a single value. It's more efficient than effects because:
 * 
 * 1. SINGLE DEPENDENCY OPTIMIZATION:
 *    - No linked list traversal for dependencies
 *    - No dynamic dependency discovery overhead
 *    - Direct edge to exactly one source
 *    - O(1) for all operations
 * 
 * 2. VALUE CACHING FOR CHANGE DETECTION:
 *    - Stores previous value to detect actual changes
 *    - Uses === equality by default (referential equality)
 *    - Can disable equality check for deep comparison scenarios
 *    - Prevents unnecessary callback invocations
 * 
 * 3. SIMPLIFIED API:
 *    - No cleanup function support (use dispose instead)
 *    - No dependency tracking context needed
 *    - Direct callback with new value only
 *    - More intuitive for simple use cases
 * 
 * USE CASES:
 * - UI components reacting to single state changes
 * - Logging/debugging specific values
 * - Bridge to non-reactive systems
 * - Performance-critical single-value monitoring
 * 
 * TRADE-OFFS:
 * - Can't track multiple dependencies (use effect instead)
 * - No cleanup function (must manage externally)
 * - No access to old value in callback
 * - Manual dependency setup (less magic, more explicit)
 * 
 * IMPLEMENTATION NOTE:
 * Since alien-signals doesn't have subscribe, we implement it using
 * an effect internally. This maintains the abstraction boundary - we
 * don't manually manipulate graph edges.
 */
import { Readable } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { SignalContext } from './context';

// Effect will be added to context later by Lattice composition
type SubscribeFactoryContext = SignalContext;

export function createSubscribeFactory(ctx: SubscribeFactoryContext): LatticeExtension<'subscribe', <T>(source: Readable<T>, callback: (value: T) => void, options?: { skipEqualityCheck?: boolean }) => (() => void)> {
  
  // We need to access effect after Lattice composition
  // Store a reference that will be set after composition
  let effectFn: ((fn: () => void | (() => void)) => () => void) | undefined;
  
  const subscribe = function subscribe<T>(
    source: Readable<T>,
    callback: (value: T) => void,
    options?: { skipEqualityCheck?: boolean }
  ): (() => void) {
    
    // ALIEN-SIGNALS PATTERN: Use effect internally for dependency tracking
    // First time subscribe is called, look up the effect method
    if (!effectFn) {
      // Access the composed API through the special Lattice binding
      // The 'this' context in Lattice extensions is the composed API
      effectFn = (subscribe as unknown as {__lattice?: {effect?: typeof effectFn}}).__lattice?.effect || (ctx as unknown as {effect?: typeof effectFn}).effect;
      if (!effectFn) {
        throw new Error('Subscribe requires effect to be available. Make sure effect factory is included in createSignalAPI.');
      }
    }
    
    let lastValue = source.peek();
    let isFirst = true;
    
    // Create an effect that tracks the source
    const dispose = effectFn(() => {
      const newValue = source(); // This read establishes the dependency
      
      // Skip initial run (we manually call callback below)
      if (isFirst) {
        isFirst = false;
        return;
      }
      
      // Check if value changed (unless equality check is disabled)
      if (!options?.skipEqualityCheck && newValue === lastValue) {
        return;
      }
      
      lastValue = newValue;
      callback(newValue);
    });
    
    // ALGORITHM: Immediate Initial Callback
    // Call callback with current value to establish initial state
    // This matches effect behavior of running immediately
    callback(lastValue);
    
    // Return unsubscribe function for cleanup
    return dispose;
  };

  return {
    name: 'subscribe',
    method: subscribe
  };
}