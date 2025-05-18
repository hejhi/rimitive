import {
  COMPONENT_FACTORY_BRAND,
  COMPONENT_INSTANCE_BRAND,
  LATTICE_BRAND,
  ComponentConfig,
  ComponentFactory,
  ComponentInstance,
  Lattice,
  ViewInstance,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';
import {
  createComponentStore,
  createStoreConfig,
  createStoreSelectors,
} from '../shared/compose/slice';

/**
 * Creates a component factory function.
 *
 * This is the primary API for creating components in Lattice. Use it to define your
 * component's model, selectors, actions, and views.
 *
 * @example
 * ```typescript
 * // Create a base component - all parts defined within a single callback
 * const counterComponent = createComponent(() => {
 *   // Define model with state and behavior
 *   const model = createModel(({ set, get }) => ({
 *     count: 0,
 *     increment: () => set(state => ({ count: state.count + 1 })),
 *     decrement: () => set(state => ({ count: state.count - 1 }))
 *   }));
 *
 *   // Define actions that delegate to model methods
 *   const actions = createActions({ model }, ({ model }) => ({
 *     increment: model().increment,
 *     decrement: model().decrement
 *   }));
 *
 *   // Define selectors that expose model properties
 *   const selectors = createSelectors({ model }, ({ model }) => ({
 *     count: model().count,
 *     isPositive: model().count > 0
 *   }));
 *
 *   // Define views for UI
 *   const counterView = createView({ selectors }, ({ selectors }) => ({
 *     "data-count": selectors().count,
 *     "aria-live": "polite"
 *   }));
 *
 *   const buttonView = createView({ actions }, ({ actions }) => ({
 *     onClick: actions().increment
 *   }));
 *
 *   // Return the component configuration
 *   return {
 *     model,
 *     actions,
 *     selectors,
 *     view: {
 *       counter: counterView,
 *       button: buttonView
 *     }
 *   };
 * });
 * ```
 *
 * @param configFactory A factory function that produces a component configuration
 * @returns A component factory function that can be used to create component instances
 */
export function createComponent<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  configFactory: () => ComponentConfig<TModel, TSelectors, TActions, TViews>
): ComponentFactory<TModel, TSelectors, TActions, TViews> {
  // Create a factory function that returns a component creator
  const componentFactory = function componentFactory(): Lattice<
    TModel,
    TSelectors,
    TActions,
    TViews
  > {
    // Get the component configuration
    const config = configFactory();

    // Validate the configuration
    if (!config.model) {
      throw new Error('Component requires a model');
    }

    if (!config.selectors) {
      throw new Error('Component requires selectors');
    }

    if (!config.actions) {
      throw new Error('Component requires actions');
    }

    if (!config.view || Object.keys(config.view).length === 0) {
      throw new Error('Component requires at least one view');
    }

    // Create the component store configuration
    const storeConfig = createStoreConfig(config);

    // Create the store using slice-based architecture
    const store = createComponentStore(storeConfig);

    // Create selectors for the store
    const selectors = createStoreSelectors(store);

    // Create a lattice with proper accessor methods to maintain backwards compatibility
    // This API will be used at compose time, while the store will be used at runtime
    const lattice: Lattice<TModel, TSelectors, TActions, TViews> =
      brandWithSymbol(
        {
          // Internal accessor methods (not exposed publicly)
          getModel: () => config.model,
          getSelectors: () => config.selectors,
          getActions: () => config.actions,

          // View accessors with name-based retrieval
          getView: <K extends keyof TViews>(
            viewName: K
          ): ViewInstance<TViews[K]> => {
            const view = config.view[viewName];
            if (!view) {
              throw new Error(`View "${String(viewName)}" not found`);
            }
            return view as ViewInstance<TViews[K]>;
          },

          getAllViews: () => {
            return { ...config.view } as {
              readonly [K in keyof TViews]: ViewInstance<TViews[K]>;
            };
          },

          // Store access
          __store: store,
          __selectors: selectors,
        },
        LATTICE_BRAND
      );

    return lattice;
  };

  return brandWithSymbol(componentFactory, COMPONENT_FACTORY_BRAND);
}

/**
 * Creates a component instance from a component factory.
 *
 * @param factory The component factory to instantiate
 * @returns A component instance
 */
export function instantiateComponent<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  factory: ComponentFactory<TModel, TSelectors, TActions, TViews>
): ComponentInstance<TModel, TSelectors, TActions, TViews> {
  return brandWithSymbol(() => factory(), COMPONENT_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createComponent', async () => {
    const { isComponentFactory } = await import('../shared/identify');

    it('should create a branded component factory', () => {
      // Mock the necessary components
      const mockModel = vi.fn();
      const mockSelectors = vi.fn();
      const mockActions = vi.fn();
      const mockView = { counter: vi.fn() };

      // Create a component factory
      const factory = createComponent(() => ({
        model: mockModel as any,
        selectors: mockSelectors as any,
        actions: mockActions as any,
        view: mockView as any,
      }));

      // Factory should be properly branded
      expect(isComponentFactory(factory)).toBe(true);
    });

    it('should throw errors for invalid configurations', () => {
      // Missing model
      expect(() => {
        const factory = createComponent(() => ({
          // @ts-expect-error
          model: undefined,
          selectors: {} as any,
          actions: {} as any,
          view: { counter: {} as any },
        }));

        factory();
      }).toThrow('Component requires a model');

      // Missing selectors
      expect(() => {
        const factory = createComponent(() => ({
          model: {} as any,
          // @ts-expect-error
          selectors: undefined,
          actions: {} as any,
          view: { counter: {} as any },
        }));

        factory();
      }).toThrow('Component requires selectors');

      // Missing actions
      expect(() => {
        const factory = createComponent(() => ({
          model: {} as any,
          selectors: {} as any,
          // @ts-expect-error
          actions: undefined,
          view: { counter: {} as any },
        }));

        factory();
      }).toThrow('Component requires actions');

      // Missing view
      expect(() => {
        const factory = createComponent(() => ({
          model: {} as any,
          selectors: {} as any,
          actions: {} as any,
          // @ts-expect-error
          view: undefined,
        }));

        factory();
      }).toThrow('Component requires at least one view');

      // Empty view object
      expect(() => {
        const factory = createComponent(() => ({
          model: {} as any,
          selectors: {} as any,
          actions: {} as any,
          view: {},
        }));

        factory();
      }).toThrow('Component requires at least one view');
    });

    it('should provide access to component parts', async () => {
      // Import necessary branding functions
      const { brandWithSymbol } = await import('../shared/identify');
      const {
        MODEL_INSTANCE_BRAND,
        SELECTORS_INSTANCE_BRAND,
        ACTIONS_INSTANCE_BRAND,
        VIEW_INSTANCE_BRAND,
      } = await import('../shared/types');

      // Define test model types
      type TestModel = { count: number };
      type TestSelectors = { isPositive: boolean };
      type TestActions = { increment: () => void };
      type TestCounterView = { 'data-count': number };
      type TestButtonView = { onClick: () => void };

      // Create properly typed test helpers for branded types
      function createMockModelInstance<T>(mockFn: (tools: any) => T) {
        return brandWithSymbol(
          () => (tools: any) => mockFn(tools),
          MODEL_INSTANCE_BRAND
        );
      }

      function createMockSelectorsInstance<T>(mockFn: (tools: any) => T) {
        return brandWithSymbol(
          () => (tools: any) => mockFn(tools),
          SELECTORS_INSTANCE_BRAND
        );
      }

      function createMockActionsInstance<T>(mockFn: (tools: any) => T) {
        return brandWithSymbol(
          () => (tools: any) => mockFn(tools),
          ACTIONS_INSTANCE_BRAND
        );
      }

      function createMockViewInstance<T>(mockFn: (tools: any) => T) {
        return brandWithSymbol(
          () => (tools: any) => mockFn(tools),
          VIEW_INSTANCE_BRAND
        );
      }

      // Create properly typed mock instances
      const mockModelFn = vi.fn((_) => ({ count: 0 }) as TestModel);
      const mockModel = createMockModelInstance(mockModelFn);

      const mockSelectorsFn = vi.fn(
        (_) => ({ isPositive: false }) as TestSelectors
      );
      const mockSelectors = createMockSelectorsInstance(mockSelectorsFn);

      const mockActionsFn = vi.fn(
        (_) => ({ increment: vi.fn() }) as TestActions
      );
      const mockActions = createMockActionsInstance(mockActionsFn);

      const mockCounterViewFn = vi.fn(
        (_) => ({ 'data-count': 0 }) as TestCounterView
      );
      const mockCounterView = createMockViewInstance(mockCounterViewFn);

      const mockButtonViewFn = vi.fn(
        (_) => ({ onClick: vi.fn() }) as TestButtonView
      );
      const mockButtonView = createMockViewInstance(mockButtonViewFn);

      // Create a component factory with properly typed mock instances
      const factory = createComponent<
        TestModel,
        TestSelectors,
        TestActions,
        { counter: TestCounterView; button: TestButtonView }
      >(() => ({
        model: mockModel as any,
        selectors: mockSelectors as any,
        actions: mockActions as any,
        view: {
          counter: mockCounterView as any,
          button: mockButtonView as any,
        },
      }));

      // Create the component
      const component = factory();

      // Component should provide access to its parts
      expect(component.getModel()).toBe(mockModel);
      expect(component.getSelectors()).toBe(mockSelectors);
      expect(component.getActions()).toBe(mockActions);
      expect(component.getView('counter')).toBe(mockCounterView);
      expect(component.getView('button')).toBe(mockButtonView);

      // Should throw for non-existent view
      expect(() => {
        // @ts-expect-error
        component.getView('nonexistent');
      }).toThrow('View "nonexistent" not found');

      // Should provide access to all views
      const allViews = component.getAllViews();
      expect(allViews.counter).toBe(mockCounterView);
      expect(allViews.button).toBe(mockButtonView);
    });
  });

  describe('instantiateComponent', () => {
    it('should create a branded component instance', () => {
      // Mock component factory
      const mockLattice = {};
      const mockFactory = vi.fn(() => mockLattice);
      const brandedFactory = brandWithSymbol(
        mockFactory,
        COMPONENT_FACTORY_BRAND
      );

      // Create an instance
      const instance = instantiateComponent(brandedFactory as any);

      // Instance should be properly branded
      expect(instance[COMPONENT_INSTANCE_BRAND]).toBe(true);

      // Should return the lattice when called
      const result = instance();
      expect(result).toBe(mockLattice);
      expect(mockFactory).toHaveBeenCalled();
    });
  });
}
