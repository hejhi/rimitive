// Subscribe utility for signals
// Provides a simple way to listen for signal/computed changes
import type { Signal, Computed } from './types';

export function createSubscribeScope(effect: (fn: () => void) => () => void) {
  /**
   * Subscribe to changes in a signal or computed value
   *
   * @param source - The signal or computed to watch
   * @param listener - Function to call when the value changes
   * @returns Cleanup function to stop listening
   */
  function subscribe<T>(
    source: Signal<T> | Computed<T>,
    listener: () => void
  ): () => void {
    let firstRun = true;

    return effect(() => {
      void source.value; // Track the source

      // Skip the first run (just subscribing, not a change)
      if (!firstRun) {
        listener();
      }
      firstRun = false;
    });
  }

  return {
    subscribe,
  };
}
