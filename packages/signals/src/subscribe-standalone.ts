// Standalone subscribe function for use without prototypes
import type { Signal, Computed, Selected, Unsubscribe } from './types';
import { effect } from './default-api';

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
  // Store the previous value to detect actual changes
  let previousValue = source.value;
  
  return effect(() => {
    const currentValue = source.value;
    // Only notify if the value actually changed
    if (!Object.is(currentValue, previousValue)) {
      previousValue = currentValue;
      listener();
    }
  });
}