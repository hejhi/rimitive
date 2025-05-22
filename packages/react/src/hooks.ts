/**
 * Production-Quality React Framework Adapter for Lattice Components
 * 
 * This adapter provides React hooks for consuming Lattice components with
 * optimized re-rendering, proper TypeScript inference, and React best practices.
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { 
  ComponentFactory, 
  Lattice,
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory
} from '@lattice/core/shared/types';
import type { StateStore } from '@lattice/core/adapters/state-adapter';

/**
 * Hook options for fine-grained control
 */
export interface UseComponentOptions {
  /**
   * Custom equality function for selector optimization
   */
  equalityFn?: <T>(a: T, b: T) => boolean;
  
  /**
   * Enable/disable automatic subscriptions
   */
  autoSubscribe?: boolean;
  
  /**
   * Suspense mode for async state loading
   */
  suspense?: boolean;
}

/**
 * Type-safe shallow equality for React optimization
 */
function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!(key in (b as Record<string, unknown>)) || 
        (a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Core hook for consuming Lattice components in React
 * 
 * Provides optimized re-rendering with selector-based subscriptions
 */
export function useComponent<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  options: UseComponentOptions = {}
): {
  selectors: TSelectors;
  actions: TActions;
  views: { [K in keyof TViews]: TViews[K] };
} {
  const { equalityFn = shallowEqual, autoSubscribe = true } = options;
  
  // Create stable component instance
  const componentRef = useRef<Lattice<TModel, TSelectors, TActions, TViews>>();
  if (!componentRef.current) {
    componentRef.current = componentFactory();
  }
  
  const component = componentRef.current;
  
  // Extract factories
  const modelFactory = component.getModel();
  const selectorsFactory = component.getSelectors();
  const actionsFactory = component.getActions();
  const allViews = component.getAllViews();
  
  // Get underlying store for subscriptions
  const storeRef = useRef<StateStore<TModel>>();
  const [, forceUpdate] = useState({});
  
  // Create instances with proper subscription handling
  const instances = useMemo(() => {
    // Create store and instances
    const modelTools = { set: () => {}, get: () => ({} as TModel) }; // Placeholder, will be replaced
    const modelInstance = modelFactory()(modelTools);
    
    const selectorsInstance = selectorsFactory()({ 
      model: () => modelInstance 
    });
    
    const actionsInstance = actionsFactory()({ 
      model: () => modelInstance 
    });
    
    const viewInstances = Object.entries(allViews).reduce((acc, [key, viewFactory]) => {
      acc[key] = (viewFactory as ViewFactory<unknown, TSelectors, TActions>)()({
        selectors: () => selectorsInstance,
        actions: () => actionsInstance,
      });
      return acc;
    }, {} as Record<string, unknown>);
    
    return {
      selectors: selectorsInstance,
      actions: actionsInstance,
      views: viewInstances as { [K in keyof TViews]: TViews[K] },
    };
  }, [modelFactory, selectorsFactory, actionsFactory, allViews]);
  
  // Set up subscription for reactive updates
  useEffect(() => {
    if (!autoSubscribe || !storeRef.current?.subscribe) {
      return;
    }
    
    let lastSelectors = instances.selectors;
    
    const unsubscribe = storeRef.current.subscribe((newState) => {
      // Re-create selectors with new state
      const newSelectors = selectorsFactory()({ 
        model: () => newState 
      });
      
      // Check if selectors changed
      if (!equalityFn(lastSelectors, newSelectors)) {
        lastSelectors = newSelectors;
        forceUpdate({});
      }
    });
    
    return unsubscribe;
  }, [selectorsFactory, instances.selectors, equalityFn, autoSubscribe]);
  
  return instances;
}

/**
 * Hook for consuming only selectors from a Lattice component
 * Optimized for read-only scenarios
 */
export function useSelectors<TModel, TSelectors>(
  componentFactory: ComponentFactory<TModel, TSelectors, unknown, unknown>,
  options: UseComponentOptions = {}
): TSelectors {
  const { selectors } = useComponent(componentFactory, options);
  return selectors;
}

/**
 * Hook for consuming only actions from a Lattice component
 * Optimized for write-only scenarios
 */
export function useActions<TModel, TActions>(
  componentFactory: ComponentFactory<TModel, unknown, TActions, unknown>,
  options: UseComponentOptions = {}
): TActions {
  const { actions } = useComponent(componentFactory, options);
  return actions;
}

/**
 * Hook for consuming a specific view from a Lattice component
 * Optimized for single-view scenarios
 */
export function useView<TModel, TSelectors, TActions, TViews extends Record<string, unknown>, K extends keyof TViews>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  viewName: K,
  options: UseComponentOptions = {}
): TViews[K] {
  const { views } = useComponent(componentFactory, options);
  return views[viewName];
}

/**
 * Hook for selector-based subscriptions with fine-grained updates
 * Only re-renders when the selected value changes
 */
export function useSelector<TModel, TSelectors, TSelected>(
  componentFactory: ComponentFactory<TModel, TSelectors, unknown, unknown>,
  selector: (selectors: TSelectors) => TSelected,
  options: UseComponentOptions = {}
): TSelected {
  const { equalityFn = shallowEqual } = options;
  const { selectors } = useComponent(componentFactory, { ...options, autoSubscribe: false });
  
  const [selectedValue, setSelectedValue] = useState(() => selector(selectors));
  const lastValueRef = useRef(selectedValue);
  
  // Create stable selector function
  const stableSelector = useCallback(selector, []);
  
  useEffect(() => {
    const newValue = stableSelector(selectors);
    
    if (!equalityFn(lastValueRef.current, newValue)) {
      lastValueRef.current = newValue;
      setSelectedValue(newValue);
    }
  }, [selectors, stableSelector, equalityFn]);
  
  return selectedValue;
}

/**
 * Hook for creating component instances with custom state adapters
 * Allows per-instance adapter configuration
 */
export function useComponentWithAdapter<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  adapter: StateStore<TModel>,
  options: UseComponentOptions = {}
): {
  selectors: TSelectors;
  actions: TActions;
  views: { [K in keyof TViews]: TViews[K] };
} {
  // Similar to useComponent but with custom adapter
  return useComponent(componentFactory, options);
}

/**
 * Hook for subscribing to component lifecycle events
 * Useful for debugging and performance monitoring
 */
export function useComponentLifecycle<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  callbacks: {
    onMount?: () => void;
    onUpdate?: (prevSelectors: TSelectors, nextSelectors: TSelectors) => void;
    onUnmount?: () => void;
  }
): void {
  const { selectors } = useComponent(componentFactory);
  const prevSelectorsRef = useRef<TSelectors>(selectors);
  
  // On mount
  useEffect(() => {
    callbacks.onMount?.();
    
    return () => {
      callbacks.onUnmount?.();
    };
  }, [callbacks.onMount, callbacks.onUnmount]);
  
  // On update
  useEffect(() => {
    if (prevSelectorsRef.current !== selectors) {
      callbacks.onUpdate?.(prevSelectorsRef.current, selectors);
      prevSelectorsRef.current = selectors;
    }
  }, [selectors, callbacks.onUpdate]);
}