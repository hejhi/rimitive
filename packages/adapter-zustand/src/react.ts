/**
 * @fileoverview React hooks for Zustand adapter
 *
 * This module provides React hooks that integrate with the Zustand adapter,
 * enabling reactive component updates with Lattice's compositional patterns.
 * 
 * Key features:
 * - Direct Zustand state selectors via useStore
 * - Auto-generated model property selectors via useModelSelector
 * - Stable action references via useAction
 * - View store subscriptions via useView with useSyncExternalStore
 * - Full TypeScript support with proper inference
 */

import { useSyncExternalStore } from 'react';
import { useStore as useZustandStore } from 'zustand/react';
import type { ExtractState } from 'zustand/vanilla';
import type { ZustandAdapterResult, Store } from './index.js';

// ============================================================================
// Hook Types
// ============================================================================


/**
 * Extracts the actions type from a ZustandAdapterResult
 */
type ExtractActions<T> = T extends ZustandAdapterResult<unknown, infer A, unknown> ? A : never;

/**
 * Extracts a specific view type from the views object
 */
type ExtractView<T, K extends keyof ExtractViews<T>> = 
  ExtractViews<T>[K] extends Store<infer V> ? V :
  ExtractViews<T>[K] extends () => Store<infer V> ? V :
  never;

/**
 * Extracts the views type from a ZustandAdapterResult
 */
type ExtractViews<T> = T extends ZustandAdapterResult<unknown, unknown, infer V> ? V : never;

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Direct Zustand selector hook for accessing model state.
 * Uses Zustand's built-in React integration for optimal performance.
 * 
 * @param store - The Zustand adapter store
 * @param selector - Optional selector function to derive specific values
 * @returns The selected state value
 * 
 * @example
 * ```tsx
 * // Get entire state
 * const state = useStore(counterStore);
 * 
 * // Select specific value
 * const count = useStore(counterStore, state => state.count);
 * 
 * // Compute derived values
 * const doubled = useStore(counterStore, state => state.count * 2);
 * ```
 */
export function useStore<
  S extends ZustandAdapterResult<unknown, unknown, unknown>
>(store: S): ExtractState<S>;
export function useStore<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  U
>(store: S, selector: (state: ExtractState<S>) => U): U;
export function useStore<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  U
>(store: S, selector?: (state: ExtractState<S>) => U) {
  if (selector) {
    return useZustandStore(store, selector);
  }
  return useZustandStore(store);
}

/**
 * Hook for using auto-generated model selectors.
 * Provides direct access to individual model properties with automatic subscription.
 * 
 * @param selectorHook - The selector hook from store.use
 * @returns The value of the selected property
 * 
 * @example
 * ```tsx
 * function Counter() {
 *   // Direct usage with proper type inference
 *   const count = useModelSelector(counterStore.use.count);
 *   const disabled = useModelSelector(counterStore.use.disabled);
 *   
 *   return <div>Count: {count}</div>;
 * }
 * ```
 */
export function useModelSelector<T>(selectorHook: () => T): T {
  return selectorHook();
}

/**
 * Hook for accessing stable action references.
 * Actions are always stable (don't change between renders) but this hook
 * ensures proper React integration and type safety.
 * 
 * @param store - The Zustand adapter store
 * @param key - The action key to access
 * @returns The action method
 * 
 * @example
 * ```tsx
 * function Counter() {
 *   const increment = useAction(counterStore, 'increment');
 *   const decrement = useAction(counterStore, 'decrement');
 *   
 *   return (
 *     <div>
 *       <button onClick={increment}>+</button>
 *       <button onClick={decrement}>-</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAction<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  K extends keyof ExtractActions<S>
>(store: S, key: K): ExtractActions<S>[K] {
  // Type assertion to ensure proper inference
  type ActionType = ExtractActions<S>[K];
  const actions = store.actions as Record<K, () => ActionType>;
  const actionHook = actions[key];
  return actionHook();
}

/**
 * Hook for subscribing to view stores.
 * Uses React's useSyncExternalStore for proper concurrent mode support.
 * 
 * @param store - The Zustand adapter store
 * @param viewKey - The view key to subscribe to
 * @returns The current view state
 * 
 * @example
 * ```tsx
 * function DisplayCounter() {
 *   // For static views (SliceFactory)
 *   const display = useView(counterStore, 'display');
 *   
 *   // For computed views (function returning SliceFactory)
 *   const summary = useView(todoStore, 'summary');
 *   
 *   return <div {...display} />;
 * }
 * ```
 */
export function useView<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  K extends keyof ExtractViews<S>
>(store: S, viewKey: K): ExtractView<S, K> {
  const views = store.views as Record<K, Store<ExtractView<S, K>> | (() => Store<ExtractView<S, K>>)>;
  const view = views[viewKey];
  
  // Handle computed views (functions that return stores)
  let viewStore: Store<ExtractView<S, K>>;
  if (typeof view === 'function') {
    viewStore = view();
  } else {
    viewStore = view;
  }
  
  if (!viewStore || typeof viewStore.subscribe !== 'function' || typeof viewStore.get !== 'function') {
    throw new Error(`Invalid view "${String(viewKey)}": views must be Store objects with get() and subscribe() methods`);
  }
  
  // Use useSyncExternalStore for proper React 18+ concurrent mode support
  return useSyncExternalStore(
    viewStore.subscribe,
    viewStore.get,
    viewStore.get // Server snapshot is the same as client
  );
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook that combines multiple selectors into a single subscription.
 * Useful for selecting multiple related values efficiently.
 * 
 * @param store - The Zustand adapter store
 * @param selector - Function that selects multiple values
 * @returns The selected values
 * 
 * @example
 * ```tsx
 * function TodoHeader() {
 *   const { activeCount, completedCount } = useStoreSelector(
 *     todoStore,
 *     state => ({
 *       activeCount: state.todos.filter(t => !t.completed).length,
 *       completedCount: state.todos.filter(t => t.completed).length
 *     })
 *   );
 *   
 *   return <div>{activeCount} active, {completedCount} completed</div>;
 * }
 * ```
 */
export function useStoreSelector<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  U
>(store: S, selector: (state: ExtractState<S>) => U): U {
  return useZustandStore(store, selector);
}

/**
 * Hook for accessing all actions at once.
 * Returns a stable object containing all action methods.
 * 
 * @param store - The Zustand adapter store
 * @returns Object containing all actions
 * 
 * @example
 * ```tsx
 * function Controls() {
 *   const actions = useActions(counterStore);
 *   
 *   return (
 *     <div>
 *       <button onClick={actions.increment}>+</button>
 *       <button onClick={actions.decrement}>-</button>
 *       <button onClick={actions.reset}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useActions<S extends ZustandAdapterResult<unknown, unknown, unknown>>(
  store: S
): ExtractActions<S> {
  // Build an object with all actions
  // Actions are stable, so this object is also stable
  const actions = {} as ExtractActions<S>;
  const storeActions = store.actions as Record<string, () => unknown>;
  
  for (const key in storeActions) {
    if (Object.prototype.hasOwnProperty.call(storeActions, key)) {
      const actionHook = storeActions[key];
      if (typeof actionHook === 'function') {
        Object.defineProperty(actions, key, {
          value: actionHook(),
          enumerable: true,
          configurable: true
        });
      }
    }
  }
  
  return actions;
}

