/**
 * @fileoverview React hooks for Zustand adapter
 *
 * This module provides React hooks that integrate with the Zustand adapter,
 * enabling reactive component updates with Lattice's compositional patterns.
 *
 * Key features:
 * - Direct Zustand state selectors via useStore
 * - Auto-generated model property selectors via useModelSelector
 * - Stable action references via useActions
 * - View store subscriptions via useView with selector functions
 * - Full TypeScript support with proper inference
 */

import * as React from 'react';
import { useStore as useZustandStore } from 'zustand/react';
import type { ExtractState } from 'zustand/vanilla';
import type { ZustandAdapterResult, Store } from './index.js';

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Extracts the actions type from a ZustandAdapterResult
 */
type ExtractActions<T> =
  T extends ZustandAdapterResult<unknown, infer A, unknown> ? A : never;


/**
 * Extracts the views type from a ZustandAdapterResult
 */
type ExtractViews<T> =
  T extends ZustandAdapterResult<unknown, unknown, infer V> ? V : never;

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
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
>(store: S): ExtractState<S>;
export function useStore<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  U,
>(store: S, selector: (state: ExtractState<S>) => U): U;
export function useStore<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  U,
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
 * Hook for accessing views with automatic reactivity using a selector function.
 * Views are now hooks that return attributes directly from the model store.
 *
 * @param store - The Zustand adapter store
 * @param selector - Selector function that receives the views object and returns a single view hook
 * @param deps - Optional dependency array for dynamic selection
 * @returns The current view attributes
 *
 * @example
 * ```tsx
 * function DisplayCounter() {
 *   // Basic usage
 *   const display = useView(counterStore, views => views.display);
 *
 *   // Dynamic selection based on state
 *   const [tabKey, setTabKey] = useState('tab1');
 *   const tabView = useView(counterStore, views => views[tabKey], [tabKey]);
 *
 *   // Conditional selection
 *   const [isLoading, setIsLoading] = useState(false);
 *   const content = useView(
 *     counterStore,
 *     views => isLoading ? views.loading : views.content,
 *     [isLoading]
 *   );
 *
 *   return <div {...display} />;
 * }
 * ```
 */
export function useView<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  V extends ExtractViews<S> = ExtractViews<S>,
  R = unknown,
>(
  store: S,
  selector: (views: V) => Store<R> | (() => Store<R>),
  deps: React.DependencyList = []
): R {
  // Get the views object from the store
  const views = store.views as V;
  
  // Use React.useMemo to memoize the view selection based on deps
  const viewHook = React.useMemo(() => {
    const selectedView = selector(views);
    
    if (typeof selectedView !== 'function') {
      throw new Error(
        `Invalid view selection: views must be hooks (functions)`
      );
    }
    
    return selectedView as () => R;
  }, [views, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  // The view hook is already reactive via the underlying model store
  // We just need to ensure React knows to re-render when the view changes
  // This is achieved by subscribing to the store and calling the view hook
  return useZustandStore(store, viewHook);
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
  U,
>(store: S, selector: (state: ExtractState<S>) => U): U {
  return useZustandStore(store, selector);
}

/**
 * Hook for accessing actions from the store.
 * Returns a stable object containing all action methods.
 * Supports destructuring for convenient access to specific actions.
 *
 * @param store - The Zustand adapter store
 * @returns Object containing all actions
 *
 * @example
 * ```tsx
 * // Get all actions
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
 *
 * // Destructure specific actions
 * function Counter() {
 *   const { increment, decrement } = useActions(counterStore);
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
export function useActions<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
>(store: S): ExtractActions<S> {
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
          configurable: true,
        });
      }
    }
  }

  return actions;
}
