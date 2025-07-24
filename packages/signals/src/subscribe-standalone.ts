// Standalone subscribe function for use without prototypes
import type { Signal, Computed, Unsubscribe } from './types';
import { effect } from './index';

/**
 * Subscribe to changes in a signal or computed value
 * 
 * @param source - The reactive value to watch
 * @param listener - Function to call when the value changes
 * @returns Cleanup function to stop listening
 * 
 * @example
 * import { signal } from '@lattice/signals/signal';
 * import { subscribe } from '@lattice/signals/subscribe';
 * 
 * const count = signal(0);
 * const unsub = subscribe(count, () => console.log('changed!'));
 */
export function subscribe<T>(
  source: Signal<T> | Computed<T>,
  listener: () => void
): Unsubscribe {
  
  // For Signal and Computed
  // Don't capture the value before creating the effect!
  // Let the effect capture it on its first run.
  let previousValue: T | undefined;
  
  return effect(() => {
    const currentValue = source.value;
    
    // If we have a previous value and it changed, notify
    if (previousValue !== undefined && !Object.is(currentValue, previousValue)) {
      listener();
    }
    
    // Always update the previous value
    previousValue = currentValue;
  });
}