/**
 * @fileoverview React hooks for Zustand adapter
 *
 * This module provides React hooks that integrate with the Zustand adapter,
 * enabling reactive component updates with Lattice's compositional patterns.
 *
 * Key features:
 * - View-based subscriptions with useViews
 * - Stable action references via direct access
 * - Full TypeScript support with proper inference
 */

import { useEffect, useState, useMemo } from 'react';
import type { ZustandAdapterResult } from './index.js';

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
 * Hook for subscribing to view changes.
 * Automatically updates component when selected views change.
 *
 * @param store - The Zustand adapter store
 * @param selector - Function to select which views to subscribe to
 * @returns The selected view values
 *
 * @example
 * ```tsx
 * function Counter() {
 *   // Subscribe to specific views
 *   const { display, button } = useViews(store, views => ({
 *     display: views.display(),
 *     button: views.button()
 *   }));
 *
 *   return (
 *     <div {...display}>
 *       <button {...button}>Click me</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useViews<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  Selected,
>(
  store: S,
  selector: (views: ExtractViews<S>) => Selected
): Selected {
  // Initialize state with the current view values
  const [state, setState] = useState<Selected>(() => {
    return selector(store.views as ExtractViews<S>);
  });

  // Subscribe to view changes
  useEffect(() => {
    const unsubscribe = store.subscribe(
      views => selector(views as ExtractViews<S>),
      (newState) => {
        setState(newState);
      }
    );

    return unsubscribe;
  }, [store]); // Don't include selector in deps as it may not be stable

  return state;
}

/**
 * Hook for accessing a single view.
 * Convenience wrapper around useViews for single view access.
 *
 * @param store - The Zustand adapter store
 * @param viewName - The name of the view to access
 * @returns The view attributes
 *
 * @example
 * ```tsx
 * function DisplayComponent() {
 *   const display = useView(store, 'display');
 *   return <div {...display}>Content</div>;
 * }
 * ```
 */
export function useView<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  K extends keyof ExtractViews<S>
>(
  store: S,
  viewName: K
): ExtractViews<S>[K] extends () => infer R ? R : never {
  return useViews(store, views => {
    const viewFn = views[viewName];
    return typeof viewFn === 'function' ? viewFn() : viewFn;
  }) as any;
}

/**
 * Hook for accessing actions.
 * Actions are stable and don't need subscriptions.
 *
 * @param store - The Zustand adapter store
 * @returns The actions object
 *
 * @example
 * ```tsx
 * function Controls() {
 *   const actions = useActions(store);
 *   
 *   return (
 *     <button onClick={actions.increment}>+</button>
 *     <button onClick={actions.decrement}>-</button>
 *   );
 * }
 * ```
 */
export function useActions<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
>(store: S): ExtractActions<S> {
  // Actions are stable, so we can just return them directly
  // Use useMemo to ensure referential stability across renders
  return useMemo(() => store.actions as ExtractActions<S>, [store]);
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook that combines views and actions for convenience.
 * Useful when you need both in the same component.
 *
 * @param store - The Zustand adapter store
 * @param viewSelector - Function to select which views to subscribe to
 * @returns Object with selected views and all actions
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const { views, actions } = useLattice(store, v => ({
 *     display: v.display(),
 *     button: v.button()
 *   }));
 *
 *   return (
 *     <div {...views.display}>
 *       <button onClick={actions.increment}>
 *         {views.button.label}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLattice<
  S extends ZustandAdapterResult<unknown, unknown, unknown>,
  Selected,
>(
  store: S,
  viewSelector: (views: ExtractViews<S>) => Selected
): {
  views: Selected;
  actions: ExtractActions<S>;
} {
  const views = useViews(store, viewSelector);
  const actions = useActions(store);
  
  return { views, actions };
}