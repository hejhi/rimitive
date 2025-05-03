import { StoreApi } from 'zustand';
import { SyncedState } from './types';

type StoreState<T> = T extends StoreApi<infer S> ? S : never;
type StoresState<T extends Record<string, StoreApi<any>>> = {
  [K in keyof T]: StoreState<T[K]>;
};

/**
 * Middleware for syncing multiple Zustand stores
 *
 * This middleware allows you to synchronize state from multiple source stores into a target store.
 * When any source store updates, the selector function is called to compute the derived state
 * which is then set on the target store.
 */
export function withStoreSync<
  TStores extends Record<string, StoreApi<any>>,
  TSelector extends (state: StoresState<TStores>) => any = (
    state: StoresState<TStores>
  ) => any,
>(stores: TStores, selector: TSelector) {
  return <TState extends object>(
    config: (
      set: StoreApi<TState & ReturnType<TSelector>>['setState'],
      get: () => TState & ReturnType<TSelector>,
      api: StoreApi<TState & ReturnType<TSelector>>
    ) => TState
  ) => {
    return (
      set: StoreApi<TState>['setState'],
      get: StoreApi<TState>['getState'],
      api: StoreApi<TState>
    ): TState & ReturnType<TSelector> & SyncedState => {
      // Subscribe to all stores
      const unsubscribers = Object.entries(stores).map(([_, store]) =>
        store.subscribe(() => {
          const storesState = Object.fromEntries(
            Object.entries(stores).map(([k, s]) => [k, s.getState()])
          ) as StoresState<TStores>;

          const selected = selector(storesState);
          set(selected as Partial<TState>);
        })
      );

      // Initialize synced props
      const initialStoresState = Object.fromEntries(
        Object.entries(stores).map(([k, s]) => [k, s.getState()])
      ) as StoresState<TStores>;

      const initialSelected = selector(initialStoresState);
      const state = config(
        set as StoreApi<TState & ReturnType<TSelector>>['setState'],
        get as () => TState & ReturnType<TSelector>,
        api as StoreApi<TState & ReturnType<TSelector>>
      );

      const cleanup = () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      };

      return {
        ...initialSelected,
        ...state,
        _syncCleanup: cleanup,
      } as TState & ReturnType<TSelector> & SyncedState;
    };
  };
}
