import { useSyncExternalStore } from 'react';
import type { Signal, Computed } from '@lattice/core';
import { devtoolsLatticeContext } from './store';

// React hook to subscribe to Lattice signals/computed values
export function useSignal<T>(signal: Signal<T> | Computed<T>): T {
  // Use React's useSyncExternalStore for proper integration
  return useSyncExternalStore(
    (onStoreChange) => {
      // Create an effect to watch the signal
      const dispose = devtoolsLatticeContext.effect(() => {
        // Read the signal value to track it
        // Access value to track dependency
        void signal.value;
        // Trigger React re-render
        onStoreChange();
      });

      return dispose;
    },
    () => signal.value,
    () => signal.value
  );
}

// Batch multiple signal updates
export function useBatch() {
  return (fn: () => void) => {
    // Use the devtools context batch function
    devtoolsLatticeContext.batch(fn);
  };
}
