/**
 * Slice-based architecture for Lattice components
 *
 * This module implements the internal slice pattern for component composition,
 * maintaining Zustand's performance benefits while providing a clean separation
 * between component parts.
 */

import { createStore } from 'zustand/vanilla';
import type { ComponentConfig, SetState, GetState, MutatedModel } from '../types';

/**
 * Store shape for slice-based component architecture
 */
export interface StoreShape<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Model slice with internal state and methods
   */
  model: TModel;

  /**
   * Selectors slice with derived values
   */
  selectors: TSelectors;

  /**
   * Actions slice for intent methods
   */
  actions: TActions;

  /**
   * View slices for UI attributes, namespaced by view name
   */
  views: {
    [K in keyof TViews]: TViews[K];
  };
}

/**
 * Configuration for creating a component store
 */
export interface ComponentStoreConfig<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Function to create the model slice
   * Uses Zustand's store API to create and manage the model slice
   */
  getModel: (
    set: SetState<StoreShape<TModel, TSelectors, TActions, TViews>>,
    get: GetState<StoreShape<TModel, TSelectors, TActions, TViews>>
  ) => TModel;

  /**
   * Function to create the selectors slice
   * Uses Zustand's store API to create the selectors slice
   */
  getSelectors: (
    set: SetState<StoreShape<TModel, TSelectors, TActions, TViews>>,
    get: GetState<StoreShape<TModel, TSelectors, TActions, TViews>>
  ) => TSelectors;

  /**
   * Function to create the actions slice
   * Uses Zustand's store API to create the actions slice
   */
  getActions: (
    set: SetState<StoreShape<TModel, TSelectors, TActions, TViews>>,
    get: GetState<StoreShape<TModel, TSelectors, TActions, TViews>>
  ) => TActions;

  /**
   * Function to create the views slice
   * Uses Zustand's store API to create the views slice
   */
  getViews: (
    set: SetState<StoreShape<TModel, TSelectors, TActions, TViews>>,
    get: GetState<StoreShape<TModel, TSelectors, TActions, TViews>>
  ) => {
    [K in keyof TViews]: TViews[K];
  };
}

/**
 * Creates a store with the slice-based architecture
 *
 * @param config The component store configuration
 * @returns A Zustand store with the slice-based architecture
 */
export function createComponentStore<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(config: ComponentStoreConfig<TModel, TSelectors, TActions, TViews>) {
  return createStore<StoreShape<TModel, TSelectors, TActions, TViews>>(
    (set, get) => ({
      model: config.getModel(set, get),
      selectors: config.getSelectors(set, get),
      actions: config.getActions(set, get),
      views: config.getViews(set, get),
    })
  );
}

/**
 * Helper function to convert a component config to a store config
 *
 * @param component The component configuration
 * @returns A store configuration for the component
 */
export function createStoreConfig<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  component: ComponentConfig<TModel, TSelectors, TActions, TViews>
): ComponentStoreConfig<TModel, TSelectors, TActions, TViews> {
  return {
    getModel: (set, get) => {
      const modelFn = component.model();
      // Use type assertion to bridge between store-level and model-level types
      // Use a type-safe adapter to bridge between store-level and model-level types
      // This ensures we can properly set and get the model state
      return modelFn({
        set: set as unknown as SetState<TModel>,
        get: () => get().model as unknown as TModel
      });
    },

    getSelectors: (_set, get) => {
      const selectorsFn = component.selectors();
      // Adapt the get function to return only the model
      // TSelectors might be a completely different type from TModel
      // This is a type-safe adapter that provides access to the model when creating selectors
      const modelGetter = () => get().model as unknown as TModel;
      const result = selectorsFn({
        get: modelGetter
      });
      return result as TSelectors; // Ensure correct return type
    },

    getActions: (_set, get) => {
      const actionsFn = component.actions();
      // Define the mutate function to provide access to the model
      return actionsFn({
        // Use type assertion to fix the MutatedModel incompatibility
        mutate: () => get().model as unknown as MutatedModel<TModel>
      });
    },

    getViews: (_set, get) => {
      const views = component.view;
      const result: Record<string, any> = {};

      Object.entries(views).forEach(([key, viewInstance]) => {
        const viewFn = viewInstance();
        // Adapt the get function for views
        result[key] = viewFn({
          get: () => get().model as TModel
        });
      });

      return result as { [K in keyof TViews]: TViews[K] };
    },
  };
}

/**
 * Selectors generator for component stores
 * Provides type-safe access to slice properties
 */
export function createStoreSelectors<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  store: ReturnType<
    typeof createComponentStore<TModel, TSelectors, TActions, TViews>
  >
) {
  return {
    /**
     * Selector for individual model properties
     * @param selector Function to select from the model slice
     * @returns The selected model property
     */
    model: <S>(selector: (model: TModel) => S): S =>
      selector(store.getState().model),

    /**
     * Selector for individual selector properties
     * @param selector Function to select from the selectors slice
     * @returns The selected selector property
     */
    selector: <S>(selector: (selectors: TSelectors) => S): S =>
      selector(store.getState().selectors),

    /**
     * Selector for individual action methods
     * @param selector Function to select from the actions slice
     * @returns The selected action method
     */
    action: <S extends Function>(selector: (actions: TActions) => S): S =>
      selector(store.getState().actions),

    /**
     * Selector for a view by name
     * @param name The name of the view
     * @returns The view object with shallow equality comparison
     */
    view: <K extends keyof TViews>(name: K): TViews[K] =>
      store.getState().views[name] as TViews[K],

    /**
     * Selector for all views
     * @returns All views with shallow equality comparison
     */
    views: (): { [K in keyof TViews]: TViews[K] } => store.getState().views,
  };
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createComponentStore', () => {
    it('should create a store with the slice-based architecture', () => {
      // Create a mock config with the updated signature
      const mockConfig = {
        getModel: vi.fn(() => ({ count: 0 })),
        getSelectors: vi.fn(() => ({ isPositive: false })),
        getActions: vi.fn(() => ({ increment: vi.fn() })),
        getViews: vi.fn(() => ({ counter: { 'data-count': 0 } })),
      };

      // Create the store
      const store = createComponentStore(mockConfig);
      const state = store.getState();

      // Verify the store has the expected slices
      expect(state.model).toEqual({ count: 0 });
      expect(state.selectors).toEqual({ isPositive: false });
      expect(typeof state.actions.increment).toBe('function');
      expect(state.views.counter).toEqual({ 'data-count': 0 });

      // Verify the config functions were called
      expect(mockConfig.getModel).toHaveBeenCalled();
      expect(mockConfig.getSelectors).toHaveBeenCalled();
      expect(mockConfig.getActions).toHaveBeenCalled();
      expect(mockConfig.getViews).toHaveBeenCalled();
    });
  });

  describe('createStoreSelectors', () => {
    it('should create type-safe selectors for the store', () => {
      // Create a mock store with getState method
      const mockStore = {
        getState: vi.fn(() => ({
          model: { count: 0 },
          selectors: { isPositive: false },
          actions: { increment: vi.fn() },
          views: { counter: { 'data-count': 0 } },
        })),
      };

      // Create the selectors
      const selectors = createStoreSelectors(mockStore as any);

      // Test the selectors
      expect(selectors.model((model) => model.count)).toBe(0);
      expect(selectors.selector((selectors) => selectors.isPositive)).toBe(
        false
      );
      expect(typeof selectors.action((actions) => actions.increment)).toBe(
        'function'
      );
      expect(selectors.view('counter')).toEqual({ 'data-count': 0 });
      expect(selectors.views()).toEqual({ counter: { 'data-count': 0 } });
    });
  });

  describe('createStoreConfig', () => {
    it('should convert a component config to a store config', () => {
      // Create mock component instances
      const mockModelFn = vi.fn(() => ({ count: 0 }));
      const mockModel = vi.fn(() => mockModelFn);

      const mockSelectorsFn = vi.fn(() => ({ isPositive: false }));
      const mockSelectors = vi.fn(() => mockSelectorsFn);

      const mockActionsFn = vi.fn(() => ({ increment: vi.fn() }));
      const mockActions = vi.fn(() => mockActionsFn);

      const mockCounterViewFn = vi.fn(() => ({ 'data-count': 0 }));
      const mockCounterView = vi.fn(() => mockCounterViewFn);

      // Create a mock component config
      const mockComponent = {
        model: mockModel,
        selectors: mockSelectors,
        actions: mockActions,
        view: { counter: mockCounterView },
      };

      // Create the store config
      const storeConfig = createStoreConfig(mockComponent as any);

      // Create mock store functions that match our expected types
      const setState = vi.fn();
      const getState = vi.fn().mockReturnValue({
        model: { count: 0 },
        selectors: { isPositive: false },
        actions: { increment: vi.fn() },
        views: { counter: { 'data-count': 0 } },
      });

      // Call the config methods to test them
      const model = storeConfig.getModel(setState, getState);
      const selectors = storeConfig.getSelectors(setState, getState);
      const actions = storeConfig.getActions(setState, getState);
      const views = storeConfig.getViews(setState, getState);
      
      // Verify the results to avoid unused variable warnings
      expect(model).toBeDefined();
      expect(selectors).toBeDefined();
      expect(actions).toBeDefined();

      // Verify that the component functions were called
      expect(mockModel).toHaveBeenCalled();
      expect(mockSelectors).toHaveBeenCalled();
      expect(mockActions).toHaveBeenCalled();
      expect(mockCounterView).toHaveBeenCalled();

      // Verify that the result functions were called
      expect(mockModelFn).toHaveBeenCalled();
      expect(mockSelectorsFn).toHaveBeenCalled();
      expect(mockActionsFn).toHaveBeenCalled();
      expect(mockCounterViewFn).toHaveBeenCalled();

      // Verify the structure of the views object
      expect(views).toHaveProperty('counter');
      expect(views.counter).toEqual({ 'data-count': 0 });
    });
  });
}
