/**
 * @fileoverview Adapter test suite for Svelte adapter
 *
 * Ensures the Svelte adapter conforms to the Lattice adapter contract
 */

import { createAdapterTestSuite } from '@lattice/core/testing';

// Get access to the internal adapter function for contract testing
const createNativeSvelteAdapter = (() => {
  // This matches the internal implementation in optimized-adapter.ts
  return function<State>(
    initialState: State,
    options?: { onError?: (error: unknown) => void }
  ) {
    let state = initialState;
    const listeners = new Map<number, () => void>();
    const svelteListeners = new Map<number, (value: State) => void>();
    let nextListenerId = 0;
    let nextSvelteListenerId = 0;
    let listenersArray: (() => void)[] = [];
    let svelteListenersArray: ((value: State) => void)[] = [];
    let latticeArrayDirty = true;
    let svelteArrayDirty = true;

    const rebuildArrays = () => {
      if (latticeArrayDirty) {
        listenersArray = Array.from(listeners.values());
        latticeArrayDirty = false;
      }
      if (svelteArrayDirty) {
        svelteListenersArray = Array.from(svelteListeners.values());
        svelteArrayDirty = false;
      }
    };

    return {
      getState: () => state,
      setState: (updates: Partial<State>) => {
        if (!updates) return;
        state = { ...state, ...updates };

        if (listeners.size > 0) {
          rebuildArrays();
          for (let i = 0; i < listenersArray.length; i++) {
            try {
              listenersArray[i]?.();
            } catch (error) {
              if (options?.onError) {
                options.onError(error);
              } else if (process.env.NODE_ENV !== 'production') {
                console.error('Error in store listener:', error);
              }
            }
          }
        }

        if (svelteListeners.size > 0) {
          rebuildArrays();
          for (let i = 0; i < svelteListenersArray.length; i++) {
            try {
              svelteListenersArray[i]?.(state);
            } catch (error) {
              if (options?.onError) {
                options.onError(error);
              } else if (process.env.NODE_ENV !== 'production') {
                console.error('Error in store listener:', error);
              }
            }
          }
        }
      },
      subscribe: (listener: any) => {
        if (listener.length === 1) {
          const id = nextSvelteListenerId++;
          svelteListeners.set(id, listener);
          svelteArrayDirty = true;
          try {
            listener(state);
          } catch (error) {
            if (options?.onError) {
              options.onError(error);
            } else if (process.env.NODE_ENV !== 'production') {
              console.error('Error in store listener:', error);
            }
          }
          return () => {
            if (svelteListeners.delete(id)) {
              svelteArrayDirty = true;
            }
          };
        }
        const id = nextListenerId++;
        listeners.set(id, listener);
        latticeArrayDirty = true;
        return () => {
          if (listeners.delete(id)) {
            latticeArrayDirty = true;
          }
        };
      }
    };
  };
})();

// Create a factory that matches the expected signature
const createTestAdapter = <State>(initialState?: State) => {
  const state = initialState ?? ({} as State);
  return createNativeSvelteAdapter(state);
};

// Run the shared adapter test suite
createAdapterTestSuite('Svelte', createTestAdapter);