import { useSyncExternalStore } from 'react';
import type { Signal, Computed, Selected } from '@lattice/core';
import { devtoolsContext } from './store/devtoolsCtx';

// React hook to subscribe to Lattice signals/computed values/selectors
export function useSignal<T>(signal: Signal<T> | Computed<T> | Selected<T>): T {
  // Use React's useSyncExternalStore for proper integration
  // Directly use the signal's subscribe method for optimal performance
  return useSyncExternalStore(
    signal.subscribe.bind(signal),
    () => signal.value,
    () => signal.value
  );
}

// Batch multiple signal updates
export function useBatch() {
  return (fn: () => void) => {
    // Use the devtools context batch function
    devtoolsContext.batch(fn);
  };
}
