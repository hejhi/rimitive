import {
  COMPONENT_FACTORY_BRAND,
  COMPONENT_FACTORY_INSTANCE_BRAND,
  LATTICE_BRAND,
  ComponentConfig,
  ComponentFactory,
  ComponentFactoryInstance,
  Lattice,
  ViewFactory,
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a component factory function.
 *
 * This is the primary API for creating components in Lattice. Use it to define your
 * component's model, selectors, actions, and views.
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

    if (!config.views || Object.keys(config.views).length === 0) {
      throw new Error('Component requires at least one view');
    }

    // Create a lattice with factory-based access methods
    // This is a pure composition layer without store dependencies
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
          ): ViewFactory<TViews[K], TSelectors, TActions> => {
            const view = config.views[viewName];
            if (!view) {
              throw new Error(`View "${String(viewName)}" not found`);
            }
            return view as ViewFactory<TViews[K], TSelectors, TActions>;
          },

          getAllViews: () => {
            return { ...config.views } as {
              readonly [K in keyof TViews]: ViewFactory<
                TViews[K],
                TSelectors,
                TActions
              >;
            };
          },
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
): ComponentFactoryInstance<TModel, TSelectors, TActions, TViews> {
  return brandWithSymbol(() => factory(), COMPONENT_FACTORY_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createComponent', async () => {
    const { mockImplementations } = await import('../test-utils');

    it('should throw errors for invalid configurations', () => {
      // Use standardized mock implementations
      const validModel = vi.fn(() => mockImplementations.counter());
      const validSelectors = vi.fn(() =>
        mockImplementations.counterSelectors()
      );
      const validActions = vi.fn(() => mockImplementations.counterActions());
      const validView = { counter: vi.fn(() => ({ 'data-count': 0 })) };

      // Create stubs with correct interface but missing implementations
      function createMockFactory<T>(mockFn: T): T {
        return mockFn;
      }

      // Create properly typed mockups as base values for tests
      const mockModelFactory = createMockFactory(
        validModel
      ) as unknown as ModelFactory<unknown>;
      const mockSelectorsFactory = createMockFactory(
        validSelectors
      ) as unknown as SelectorsFactory<unknown>;
      const mockActionsFactory = createMockFactory(
        validActions
      ) as unknown as ActionsFactory<unknown>;
      const mockViewFactory = {
        counter: createMockFactory(
          validView.counter
        ) as unknown as ViewFactory<unknown>,
      };

      // Missing model
      expect(() => {
        const factory = createComponent(() => ({
          model: undefined as unknown as ModelFactory<unknown>,
          selectors: mockSelectorsFactory,
          actions: mockActionsFactory,
          views: mockViewFactory,
        }));

        factory();
      }).toThrow('Component requires a model');

      // Missing selectors
      expect(() => {
        const factory = createComponent(() => ({
          model: mockModelFactory,
          selectors: undefined as unknown as SelectorsFactory<unknown>,
          actions: mockActionsFactory,
          views: mockViewFactory,
        }));

        factory();
      }).toThrow('Component requires selectors');

      // Missing actions
      expect(() => {
        const factory = createComponent(() => ({
          model: mockModelFactory,
          selectors: mockSelectorsFactory,
          actions: undefined as unknown as ActionsFactory<unknown>,
          views: mockViewFactory,
        }));

        factory();
      }).toThrow('Component requires actions');

      // Missing views
      expect(() => {
        const factory = createComponent(() => ({
          model: mockModelFactory,
          selectors: mockSelectorsFactory,
          actions: mockActionsFactory,
          views: undefined as unknown as Record<string, ViewFactory<unknown>>,
        }));

        factory();
      }).toThrow('Component requires at least one view');

      // Empty view object
      expect(() => {
        const factory = createComponent(() => ({
          model: mockModelFactory,
          selectors: mockSelectorsFactory,
          actions: mockActionsFactory,
          views: {},
        }));

        factory();
      }).toThrow('Component requires at least one view');
    });

    it('should provide access to component parts', async () => {
      // Import branding function for tests
      const { brandWithSymbol } = await import('../shared/identify');
      const {
        MODEL_FACTORY_BRAND,
        SELECTORS_FACTORY_BRAND,
        ACTIONS_FACTORY_BRAND,
        VIEW_FACTORY_BRAND,
      } = await import('../shared/types');

      // Define test model types with explicit interfaces
      interface TestModel {
        count: number;
      }

      interface TestSelectors {
        isPositive: boolean;
      }

      interface TestActions {
        increment: () => void;
      }

      interface TestCounterView {
        'data-count': number;
      }

      interface TestButtonView {
        onClick: () => void;
      }

      // Create properly typed test helpers for branded types
      function createMockModelFactory<T>(implementation: T): ModelFactory<T> {
        return brandWithSymbol(
          () => () => implementation,
          MODEL_FACTORY_BRAND
        ) as unknown as ModelFactory<T>;
      }

      function createMockSelectorsFactory<T>(
        implementation: T
      ): SelectorsFactory<T> {
        return brandWithSymbol(
          () => () => implementation,
          SELECTORS_FACTORY_BRAND
        ) as unknown as SelectorsFactory<T>;
      }

      function createMockActionsFactory<T>(
        implementation: T
      ): ActionsFactory<T> {
        return brandWithSymbol(
          () => () => implementation,
          ACTIONS_FACTORY_BRAND
        ) as unknown as ActionsFactory<T>;
      }

      function createMockViewFactory<T>(implementation: T): ViewFactory<T> {
        return brandWithSymbol(
          () => () => implementation,
          VIEW_FACTORY_BRAND
        ) as unknown as ViewFactory<T>;
      }

      // Create properly typed mock instances
      const mockModelImplementation: TestModel = { count: 0 };
      const mockModel = createMockModelFactory<TestModel>(
        mockModelImplementation
      );

      const mockSelectorsImplementation: TestSelectors = { isPositive: false };
      const mockSelectors = createMockSelectorsFactory<TestSelectors>(
        mockSelectorsImplementation
      );

      const mockActionsImplementation: TestActions = { increment: vi.fn() };
      const mockActions = createMockActionsFactory<TestActions>(
        mockActionsImplementation
      );

      const mockCounterViewImplementation: TestCounterView = {
        'data-count': 0,
      };
      const mockCounterView = createMockViewFactory<TestCounterView>(
        mockCounterViewImplementation
      );

      const mockButtonViewImplementation: TestButtonView = { onClick: vi.fn() };
      const mockButtonView = createMockViewFactory<TestButtonView>(
        mockButtonViewImplementation
      );

      // Create a component factory with properly typed mock instances
      const factory = createComponent(() => ({
        model: mockModel,
        selectors: mockSelectors,
        actions: mockActions,
        views: {
          counter: mockCounterView,
          button: mockButtonView,
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
        (component.getView as any)('nonexistent');
      }).toThrow('View "nonexistent" not found');

      // Should provide access to all views
      const allViews = component.getAllViews();
      expect(allViews.counter).toBe(mockCounterView);
      expect(allViews.button).toBe(mockButtonView);
    });
  });

  describe('instantiateComponent', () => {
    it('should create a branded component instance', () => {
      // Mock component factory with proper typing
      const mockLattice = {} as Lattice<
        unknown,
        unknown,
        unknown,
        Record<string, unknown>
      >;
      const mockFactory = vi.fn(() => mockLattice);
      const brandedFactory = brandWithSymbol(
        mockFactory,
        COMPONENT_FACTORY_BRAND
      );

      // Create an instance with proper typing
      const instance = instantiateComponent(
        brandedFactory as ComponentFactory<
          unknown,
          unknown,
          unknown,
          Record<string, unknown>
        >
      );

      // Instance should be properly branded
      expect(instance[COMPONENT_FACTORY_INSTANCE_BRAND]).toBe(true);

      // Should return the lattice when called
      const result = instance();
      expect(result).toBe(mockLattice);
      expect(mockFactory).toHaveBeenCalled();
    });
  });
}
