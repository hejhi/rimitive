import { StoreApi } from 'zustand';
import { Selector, Subscriber } from './types';

/**
 * Utility function to subscribe to a Zustand store and select specific state
 * Used to create reactive subscribers that can be composed
 *
 * @param store The Zustand store to subscribe to
 * @param selector Function to select specific state from the store
 * @returns A subscriber object that provides reactive access to the selected state
 */
export function withStoreSubscribe<TState, TSelectedState>(
  store: StoreApi<TState>,
  selector: Selector<TState, TSelectedState>
): Subscriber<TSelectedState> {
  return {
    subscribe: (callback) => {
      // Subscribe to the store and call the callback with the selected state
      return store.subscribe((state) => {
        const selectedState = selector(state);
        callback(selectedState);
      });
    },
    getState: () => {
      // Get the current state from the store and apply the selector
      return selector(store.getState());
    },
  };
}
