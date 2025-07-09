import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import type { Signal, Computed } from '@lattice/signals';
import { devtoolsLatticeContext } from './store';

// React hook to subscribe to Lattice signals/computed values
export function useSignal<T>(signal: Signal<T> | Computed<T>): T {
  // Use React's useSyncExternalStore for proper integration
  return useSyncExternalStore(
    (onStoreChange) => {
      // Create an effect to watch the signal
      const dispose = devtoolsLatticeContext.effect(() => {
        // Read the signal value to track it
        signal.value;
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
    // Since we're in the devtools context, we can use the global batch
    if (typeof (globalThis as any).__latticeBatch === 'function') {
      (globalThis as any).__latticeBatch(fn);
    } else {
      fn();
    }
  };
}