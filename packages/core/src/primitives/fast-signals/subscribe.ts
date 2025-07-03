// Subscribe utility for fast-signals
// Provides a simple way to listen for signal/computed changes

import { effect } from './effect';
import type { Signal, Computed } from './types';

/**
 * Subscribe to changes in a signal or computed value
 * 
 * @param source - The signal or computed to watch
 * @param listener - Function to call when the value changes
 * @returns Cleanup function to stop listening
 */
export function subscribe<T>(
  source: Signal<T> | Computed<T>,
  listener: () => void
): () => void {
  let firstRun = true;
  
  return effect(() => {
    source(); // Track the source
    
    // Skip the first run (just subscribing, not a change)
    if (!firstRun) {
      listener();
    }
    firstRun = false;
  });
}