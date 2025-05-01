import { StoreApi } from 'zustand';
import { StateCreator, StoreStateSelector } from './types';

/**
 * Middleware for syncing multiple Zustand stores
 *
 * This middleware allows you to synchronize state from multiple source stores into a target store.
 * When any source store updates, the selector function is called to compute the derived state
 * which is then set on the target store.
 */
export function withStoreSync<
  S extends Record<string, StoreApi<any>>,
  T extends object,
  U extends object,
>(stores: S, selector: StoreStateSelector<S, T>) {
  return (config: StateCreator<U>) =>
    (
      set: StoreApi<U>['setState'],
      get: StoreApi<U>['getState'],
      api: StoreApi<U>
    ) => {
      // Subscribe to all stores
      const unsubscribers = Object.entries(stores).map(([_storeKey, store]) =>
        store.subscribe(() => {
          // When any store updates, recompute and set the synced props
          const selected = selector(
            Object.fromEntries(
              Object.entries(stores).map(([k, s]) => [k, s.getState()])
            ) as any
          );
          set(selected as Partial<U>);
        })
      );

      // Initialize synced props
      const initialSelected = selector(
        Object.fromEntries(
          Object.entries(stores).map(([k, s]) => [k, s.getState()])
        ) as any
      );

      const state = config(set, get, api);

      // We need to unsubscribe from all stores when the component unmounts
      // or when the store is no longer needed
      // In a real implementation, this might be handled by the consuming code
      const cleanup = () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      };

      // In a real application, you'd need to call cleanup when appropriate
      // This is simplified for the example
      // api.cleanup = cleanup; // Not part of StoreApi, would need custom handling

      return {
        ...(initialSelected as object),
        ...state,
        // Add a cleanup method that consuming code can call
        _syncCleanup: cleanup,
      };
    };
}
