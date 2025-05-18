/**
 * Slice-based architecture for Lattice components
 *
 * This module implements the internal slice pattern for component composition,
 * maintaining Zustand's performance benefits while providing a clean separation
 * between component parts.
 */

import { createStore } from 'zustand/vanilla';
import type {
  ComponentConfig,
  SetState,
  GetState,
  MutatedModel,
  ViewFactory,
} from '../types';

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
   * This is implemented as a getter that computes fresh values on each access
   */
  readonly selectors: TSelectors;

  /**
   * Actions slice for intent methods
   */
  actions: TActions;

  /**
   * View slices for UI attributes, namespaced by view name
   * This is implemented as a getter that computes fresh views on each access
   */
  readonly views: {
    readonly [K in keyof TViews]: TViews[K];
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
   * Uses Zustand's store API to create a getter function for selectors
   * This returns a function that will be used as a getter to get fresh selectors
   */
  getSelectors: (
    set: SetState<StoreShape<TModel, TSelectors, TActions, TViews>>,
    get: GetState<StoreShape<TModel, TSelectors, TActions, TViews>>
  ) => () => TSelectors;

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
   * Uses Zustand's store API to create a getter function for views
   * This returns a function that will be used as a getter to get fresh views
   */
  getViews: (
    set: SetState<StoreShape<TModel, TSelectors, TActions, TViews>>,
    get: GetState<StoreShape<TModel, TSelectors, TActions, TViews>>
  ) => () => {
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
    (set, get) => {
      // Get the model and actions directly
      const model = config.getModel(set, get);
      const actions = config.getActions(set, get);
      
      // Get the selector and view factory functions
      const selectorsFactory = config.getSelectors(set, get);
      const viewsFactory = config.getViews(set, get);
      
      // Create an object with getter properties for selectors and views
      return {
        model,
        actions,
        // Define selectors as a getter property that calls the factory function
        get selectors() {
          return selectorsFactory();
        },
        // Define views as a getter property that calls the factory function
        get views() {
          return viewsFactory();
        }
      };
    }
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
        get: () => get().model as unknown as TModel,
      });
    },

    getSelectors: (_set, get) => {
      const selectorsFn = component.selectors();
      // Adapt the get function to return only the model
      // TSelectors might be a completely different type from TModel
      // This is a type-safe adapter that provides access to the model when creating selectors
      const modelGetter = () => get().model as TModel;

      // Create a selector factory function that will be used as a getter
      // This function will be called each time the selectors property is accessed
      // ensuring we always get fresh values based on the current model state
      return function getSelectorValues() {
        // Create a properly typed tools object for selectors
        // Using a type assertion to bridge between the model type and selectors type
        // This is safe because we're controlling how the model is used within selectors
        return selectorsFn({
          // Create an adapter that matches what the selectors function expects
          model: modelGetter,
          get: (() => get().model) as unknown as GetState<any>,
        });
      };
    },

    getActions: (_set, get) => {
      const actionsFn = component.actions();
      // Define the mutate function to provide access to the model
      return actionsFn({
        // Use type assertion to fix the MutatedModel incompatibility
        mutate: <M>(model: M): MutatedModel<M> => {
          if (model === undefined) {
            // When called with no arguments, use the store's model
            return get().model as unknown as MutatedModel<M>;
          }
          // Otherwise mutate the provided model
          return model as unknown as MutatedModel<M>;
        },
      });
    },

    getViews: (_set, get) => {
      const views = component.view;
      
      // Create properly typed accessors for selectors and actions
      // These ensure we always access the most up-to-date values via the getters
      const selectorsGetter = () => get().selectors as TSelectors;
      const actionsGetter = () => get().actions as TActions;

      // Return a function that will be used as a getter
      // This will be called each time the views property is accessed
      return function getViewValues() {
        const result: Record<string, unknown> = {};
        
        Object.entries(views).forEach(([key, viewInstance]) => {
          // Assert the view instance type more specifically
          const typedViewInstance = viewInstance as ViewFactory<unknown>;
          const viewFn = typedViewInstance();

          // Create a properly typed view tools adapter that satisfies both interfaces
          const viewTools = {
            selectors: selectorsGetter,
            actions: actionsGetter,
            get: () => result[key] || {}, // Provide a default get function for backward compatibility
          };

          // Create view with properly typed dependencies
          // This ensures views are always calculated based on the current state
          result[key] = viewFn(viewTools);
        });

        return result as { [K in keyof TViews]: TViews[K] };
      };
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
    it('should create a store with the slice-based architecture using namespace-level getters', () => {
      // Create a mock store state with namespace-level getters
      const mockModel = { count: 0 };

      // Define a mock config with functions that return the appropriate getters
      // This structure now properly aligns with the updated ComponentStoreConfig interface
      const mockConfig = {
        getModel: vi.fn(() => mockModel),
        getSelectors: vi.fn((_set, get) => {
          // Return a function that will be used as a getter
          // Using _set to indicate the parameter is not used
          return () => ({
            isPositive: get().model.count > 0,
            count: get().model.count,
          });
        }),
        getActions: vi.fn(() => ({
          increment: vi.fn(() => {
            mockModel.count += 1;
          }),
        })),
        getViews: vi.fn((_set, get) => {
          // Return a function that will be used as a getter
          // Using _set to indicate the parameter is not used
          return () => ({
            counter: {
              'data-count': get().model.count,
              'data-positive': get().selectors.isPositive,
            },
          });
        }),
      };

      // Create the store
      const store = createComponentStore(mockConfig);
      const state = store.getState();

      // Verify the store has the expected slices
      expect(state.model).toEqual({ count: 0 });
      expect(state.selectors).toEqual({
        count: 0,
        isPositive: false,
      });
      expect(typeof state.actions.increment).toBe('function');
      expect(state.views.counter).toEqual({
        'data-count': 0,
        'data-positive': false,
      });

      // Call the increment action
      state.actions.increment();

      // Get the updated state
      const updatedState = store.getState();

      // Verify selectors and views are updated through the getters
      expect(updatedState.model.count).toBe(1);
      expect(updatedState.selectors.isPositive).toBe(true);
      expect(updatedState.selectors.count).toBe(1);
      expect(updatedState.views.counter).toEqual({
        'data-count': 1,
        'data-positive': true,
      });

      // Verify the config functions were called
      expect(mockConfig.getModel).toHaveBeenCalled();
      expect(mockConfig.getSelectors).toHaveBeenCalled();
      expect(mockConfig.getActions).toHaveBeenCalled();
      expect(mockConfig.getViews).toHaveBeenCalled();
    });
  });

  describe('createStoreSelectors', () => {
    it('should create type-safe selectors for the store', () => {
      // Define mock store types
      type TestModel = { count: number };
      type TestSelectors = { isPositive: boolean };
      type TestActions = { increment: () => void };
      type TestViews = { counter: { 'data-count': number } };

      // Define the store shape
      type TestStore = StoreShape<
        TestModel,
        TestSelectors,
        TestActions,
        TestViews
      >;

      // Create a mock store with getState method
      const mockStore = {
        getState: vi.fn(
          (): TestStore => ({
            model: { count: 0 },
            selectors: { isPositive: false },
            actions: { increment: vi.fn() },
            views: { counter: { 'data-count': 0 } },
          })
        ),
      };

      // Create a properly typed mock store
      // We need to use a type assertion to bridge the gap between our mock and a real store
      const typedMockStore = mockStore as unknown as ReturnType<
        typeof createComponentStore<
          TestModel,
          TestSelectors,
          TestActions,
          TestViews
        >
      >;

      // Create the selectors with proper type
      const selectors = createStoreSelectors(typedMockStore);

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
    it('should convert a component config to a store config with namespace-level getters', () => {
      // Create mock component instances
      const mockModelData = { count: 0 };
      const mockModelFn = vi.fn(() => mockModelData);
      const mockModel = vi.fn(() => mockModelFn);

      // Create mock selectors function that returns selectors based on model
      const mockSelectorsFn = vi.fn(({ model }) => ({
        isPositive: model().count > 0,
        count: model().count
      }));
      const mockSelectors = vi.fn(() => mockSelectorsFn);

      // Create mock actions
      const mockActionsFn = vi.fn(() => ({ 
        increment: vi.fn(() => {
          mockModelData.count += 1;
        })
      }));
      const mockActions = vi.fn(() => mockActionsFn);

      // Create mock view function that returns view props based on selectors
      const mockCounterViewFn = vi.fn(({ selectors }) => ({ 
        'data-count': selectors().count,
        'data-positive': selectors().isPositive
      }));
      const mockCounterView = vi.fn(() => mockCounterViewFn);

      // Define test types
      type TestModel = { count: number };
      type TestSelectors = { isPositive: boolean; count: number };
      type TestActions = { increment: () => void };
      type TestViews = { counter: { 'data-count': number; 'data-positive': boolean } };
      
      // Create a properly typed mock component
      const mockComponent: ComponentConfig<
        TestModel,
        TestSelectors,
        TestActions,
        TestViews
      > = {
        model: mockModel as any,
        selectors: mockSelectors as any,
        actions: mockActions as any,
        view: { counter: mockCounterView as any },
      };

      // Create the store config with proper typing
      const storeConfig = createStoreConfig<
        TestModel,
        TestSelectors,
        TestActions,
        TestViews
      >(mockComponent);

      // Create mock store functions that match our expected types
      const setState = vi.fn();
      
      // Create a mock state object with all required properties
      // The object needs selectors and views to match the full StoreShape
      const mockStateObject = {
        model: mockModelData,
        actions: { 
          increment: vi.fn(() => {
            mockModelData.count += 1;
          })
        },
        // These will be replaced with proper getters below
        selectors: {} as TestSelectors,
        views: {} as { [K in keyof TestViews]: TestViews[K] }
      };
      
      // Mock getState to return our mock state object
      const getState = vi.fn(() => mockStateObject);

      // Call the config methods to test them
      storeConfig.getModel(setState, getState); // Call but don't store the result to avoid unused var warnings
      const selectorsFactory = storeConfig.getSelectors(setState, getState);
      storeConfig.getActions(setState, getState); // Call but don't store the result to avoid unused var warnings
      const viewsFactory = storeConfig.getViews(setState, getState);
      
      // Test that the factories now return functions (for getters)
      expect(typeof selectorsFactory).toBe('function');
      expect(typeof viewsFactory).toBe('function');
      
      // Setup the getter properties on our mock state
      // These getters will call the factory functions each time they're accessed
      Object.defineProperty(mockStateObject, 'selectors', {
        configurable: true,
        get: selectorsFactory // This is now a function that returns the selectors object
      });
      
      Object.defineProperty(mockStateObject, 'views', {
        configurable: true,
        get: viewsFactory // This is now a function that returns the views object
      });
      
      // Verify initial state through the getters
      expect(mockStateObject.selectors.isPositive).toBe(false);
      expect(mockStateObject.selectors.count).toBe(0);
      expect(mockStateObject.views.counter).toEqual({ 
        'data-count': 0, 
        'data-positive': false 
      });
      
      // Modify the model and verify the getters update
      mockModelData.count = 5;
      
      // Check that selectors and views update reactively through getters
      expect(mockStateObject.selectors.isPositive).toBe(true);
      expect(mockStateObject.selectors.count).toBe(5);
      expect(mockStateObject.views.counter).toEqual({ 
        'data-count': 5, 
        'data-positive': true 
      });

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
    });
  });
}
