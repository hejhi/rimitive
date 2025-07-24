// Standalone subscribe function for use without prototypes
import type { Signal, Computed, Selected, Unsubscribe } from './types';
import { effect } from './index';

/**
 * Subscribe to changes in a signal, computed, or selected value
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
  source: Signal<T> | Computed<T> | Selected<T>,
  listener: () => void
): Unsubscribe {
  // Check if it's a Selected value with its own subscribe logic
  if ('_subscribe' in source) {
    return source._subscribe(listener);
  }
  
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