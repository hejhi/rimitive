import {
  ComponentConfig,
  WithComponentCallback,
  ComponentFactory,
  ComponentExtension,
  Lattice,
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
} from '../shared/types';
import { createComponent } from './create';

/**
 * Composes a component with extensions.
 *
 * This function enables composition of components, allowing selective extension or replacement
 * of component parts (model, selectors, actions, views).
 *
 * @param baseComponent The base component to extend
 * @param callback A function that receives tools to access the base component and returns extensions
 * @returns A function to be used with createComponent
 */
export function withComponent<
  TBaseModel,
  TBaseSelectors,
  TBaseActions,
  TBaseViews extends Record<string, unknown>,
  TExtModel extends TBaseModel,
  TExtSelectors extends TBaseSelectors,
  TExtActions extends TBaseActions,
  TExtViews extends TBaseViews,
>(
  baseComponent: ComponentFactory<
    TBaseModel,
    TBaseSelectors,
    TBaseActions,
    TBaseViews
  >,
  callback: WithComponentCallback<
    TBaseModel,
    TBaseSelectors,
    TBaseActions,
    TBaseViews,
    TExtModel,
    TExtSelectors,
    TExtActions,
    TExtViews
  >
): () => ComponentConfig<TExtModel, TExtSelectors, TExtActions, TExtViews> {
  return () => {
    // Instantiate the base component to access its parts
    const component = baseComponent();

    // Create elements to provide direct access to component parts
    const elements: ComponentConfig<
      TBaseModel,
      TBaseSelectors,
      TBaseActions,
      TBaseViews
    > = {
      model: component.getModel(),
      selectors: component.getSelectors(),
      actions: component.getActions(),
      view: component.getAllViews(),
    };

    // Get extensions from the callback using the elements
    const extensions = callback(elements);

    // Since we have constraints (TExtModel extends TBaseModel), we can safely create a properly typed result
    // Type assertions are used here because TypeScript doesn't recognize that the fallback case
    // preserves the original type which is already compatible due to the extends constraint
    const result: ComponentConfig<
      TExtModel,
      TExtSelectors,
      TExtActions,
      TExtViews
    > = {
      model: (extensions.model ||
        component.getModel()) as ModelFactory<TExtModel>,
      selectors: (extensions.selectors ||
        component.getSelectors()) as SelectorsFactory<TExtSelectors>,
      actions: (extensions.actions ||
        component.getActions()) as ActionsFactory<TExtActions>,
      view: (extensions.view || component.getAllViews()) as {
        [K in keyof TExtViews]: ViewFactory<TExtViews[K]>;
      },
    };
    return result;
  };
}

/**
 * Creates a new component by extending an existing one.
 *
 * This is a convenience function that combines createComponent and withComponent.
 *
 * @param baseComponent The base component to extend
 * @param callback A function that receives tools to access the base component and returns extensions
 * @returns A new component factory
 */
export function extendComponent<
  TBaseModel,
  TBaseSelectors,
  TBaseActions,
  TBaseViews extends Record<string, unknown>,
  TExtModel extends TBaseModel,
  TExtSelectors extends TBaseSelectors,
  TExtActions extends TBaseActions,
  TExtViews extends TBaseViews,
>(
  baseComponent: ComponentFactory<
    TBaseModel,
    TBaseSelectors,
    TBaseActions,
    TBaseViews
  >,
  callback: WithComponentCallback<
    TBaseModel,
    TBaseSelectors,
    TBaseActions,
    TBaseViews,
    TExtModel,
    TExtSelectors,
    TExtActions,
    TExtViews
  >
): ComponentFactory<TExtModel, TExtSelectors, TExtActions, TExtViews> {
  return createComponent(withComponent(baseComponent, callback));
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('withComponent', async () => {
    // Import modules once at the describe level
    const { brandWithSymbol } = await import('../shared/identify');
    const {
      MODEL_FACTORY_BRAND,
      SELECTORS_FACTORY_BRAND,
      ACTIONS_FACTORY_BRAND,
      VIEW_FACTORY_BRAND,
      LATTICE_BRAND,
      COMPONENT_FACTORY_BRAND,
    } = await import('../shared/types');

    // Create mock components for all tests in this describe block
    // Create properly typed mocks that match the factory interfaces
    const mockModel = brandWithSymbol(
      () => (_: any) => ({}),
      MODEL_FACTORY_BRAND
    );
    const mockSelectors = brandWithSymbol(
      () => (_: any) => ({}),
      SELECTORS_FACTORY_BRAND
    );
    const mockActions = brandWithSymbol(
      () => (_: any) => ({}),
      ACTIONS_FACTORY_BRAND
    );
    const mockCounterView = brandWithSymbol(
      () => (_: any) => ({}),
      VIEW_FACTORY_BRAND
    );
    const mockButtonView = brandWithSymbol(
      () => (_: any) => ({}),
      VIEW_FACTORY_BRAND
    );

    const mockLattice = brandWithSymbol(
      {
        getModel: () => mockModel,
        getSelectors: () => mockSelectors,
        getActions: () => mockActions,
        getView: (name: string) => {
          if (name === 'counter') return mockCounterView;
          if (name === 'button') return mockButtonView;
          throw new Error(`View "${name}" not found`);
        },
        getAllViews: () => ({
          counter: mockCounterView,
          button: mockButtonView,
        }),
      },
      LATTICE_BRAND
    );

    // Create a properly typed mock component factory that returns the mock lattice
    const mockComponentFactory = brandWithSymbol(
      () =>
        mockLattice as unknown as Lattice<
          unknown,
          unknown,
          unknown,
          { counter: unknown; button: unknown }
        >,
      COMPONENT_FACTORY_BRAND
    ) as unknown as ComponentFactory<
      unknown,
      unknown,
      unknown,
      { counter: unknown; button: unknown }
    >;

    it('should provide access to component elements', () => {
      // Create a callback that accesses the component elements
      const callbackSpy = vi.fn((elements) => {
        expect(elements.model).toBe(mockModel);
        expect(elements.selectors).toBe(mockSelectors);
        expect(elements.actions).toBe(mockActions);
        expect(elements.view.counter).toBe(mockCounterView);
        expect(elements.view.button).toBe(mockButtonView);

        return {};
      });

      // Call withComponent
      const factory = withComponent(mockComponentFactory, callbackSpy);
      factory();

      // Ensure the callback was called
      expect(callbackSpy).toHaveBeenCalled();
    });

    it('should allow extending the component', () => {
      // Define test types
      type TestBaseModel = { count: number };
      type TestBaseSelectors = { isPositive: boolean };
      type TestBaseActions = { increment: () => void };
      type TestBaseViews = {
        counter: { 'data-count': number };
        button: { onClick: () => void };
      };

      type TestExtModel = TestBaseModel & { reset: () => void };
      type TestExtSelectors = TestBaseSelectors & { isEven: boolean };
      type TestExtActions = TestBaseActions & { reset: () => void };
      type TestExtViews = TestBaseViews & {
        reset: { onClick: () => void };
      };

      // Create properly typed mock factories
      const extModel = brandWithSymbol(
        () => (_: any) => ({ count: 0, reset: vi.fn() }) as TestExtModel,
        MODEL_FACTORY_BRAND
      );
      const extSelectors = brandWithSymbol(
        () => (_: any) =>
          ({ isPositive: false, isEven: true }) as TestExtSelectors,
        SELECTORS_FACTORY_BRAND
      );
      const extActions = brandWithSymbol(
        () => (_: any) =>
          ({ increment: vi.fn(), reset: vi.fn() }) as TestExtActions,
        ACTIONS_FACTORY_BRAND
      );
      const extCounterView = brandWithSymbol(
        () => (_: any) => ({ 'data-count': 0 }) as TestExtViews['counter'],
        VIEW_FACTORY_BRAND
      );
      const extResetView = brandWithSymbol(
        () => (_: any) => ({ onClick: vi.fn() }) as TestExtViews['reset'],
        VIEW_FACTORY_BRAND
      );

      // Create a properly typed callback
      const callback = (
        _: ComponentConfig<
          TestBaseModel,
          TestBaseSelectors,
          TestBaseActions,
          TestBaseViews
        >
      ): ComponentExtension<
        TestExtModel,
        TestExtSelectors,
        TestExtActions,
        TestExtViews
      > => {
        return {
          model: extModel as unknown as ModelFactory<TestExtModel>,
          selectors:
            extSelectors as unknown as SelectorsFactory<TestExtSelectors>,
          actions: extActions as unknown as ActionsFactory<TestExtActions>,
          view: {
            counter: extCounterView as unknown as ViewFactory<
              TestExtViews['counter']
            >,
            reset: extResetView as unknown as ViewFactory<
              TestExtViews['reset']
            >,
          },
        };
      };

      // Create a properly typed mock component factory
      const typedMockComponentFactory =
        mockComponentFactory as unknown as ComponentFactory<
          TestBaseModel,
          TestBaseSelectors,
          TestBaseActions,
          TestBaseViews
        >;

      // Call withComponent with properly typed parameters
      const factory = withComponent<
        TestBaseModel,
        TestBaseSelectors,
        TestBaseActions,
        TestBaseViews,
        TestExtModel,
        TestExtSelectors,
        TestExtActions,
        TestExtViews
      >(typedMockComponentFactory, callback);

      const result = factory();

      // Ensure extensions were returned correctly
      expect(result.model).toBe(extModel);
      expect(result.selectors).toBe(extSelectors);
      expect(result.actions).toBe(extActions);
      expect(result.view.counter).toBe(extCounterView);
      expect(result.view.reset).toBe(extResetView);
    });

    it('should use base components when extensions are not provided', () => {
      // Define test types
      type TestBaseModel = { count: number };
      type TestBaseSelectors = { isPositive: boolean };
      type TestBaseActions = { increment: () => void };
      type TestBaseViews = {
        counter: { 'data-count': number };
        button: { onClick: () => void };
      };

      type TestExtModel = TestBaseModel & { reset: () => void };

      // Create a properly typed extended model
      const extModel = brandWithSymbol(
        () => (_: any) => ({ count: 0, reset: vi.fn() }) as TestExtModel,
        MODEL_FACTORY_BRAND
      );

      // Create a properly typed callback that only extends the model
      const callback = (
        elements: ComponentConfig<
          TestBaseModel,
          TestBaseSelectors,
          TestBaseActions,
          TestBaseViews
        >
      ): ComponentExtension<
        TestExtModel,
        TestBaseSelectors,
        TestBaseActions,
        TestBaseViews
      > => {
        // Use elements to demonstrate proper usage
        console.log('Base model:', elements.model);

        return {
          // Only extend the model
          model: extModel as unknown as ModelFactory<TestExtModel>,
        };
      };

      // Create a properly typed mock component factory
      const typedMockComponentFactory =
        mockComponentFactory as unknown as ComponentFactory<
          TestBaseModel,
          TestBaseSelectors,
          TestBaseActions,
          TestBaseViews
        >;

      // Call withComponent with properly typed parameters
      const factory = withComponent<
        TestBaseModel,
        TestBaseSelectors,
        TestBaseActions,
        TestBaseViews,
        TestExtModel,
        TestBaseSelectors,
        TestBaseActions,
        TestBaseViews
      >(typedMockComponentFactory, callback);

      const result = factory();

      // Ensure only the model was extended
      expect(result.model).toBe(extModel);
      expect(result.selectors).toBe(mockSelectors);
      expect(result.actions).toBe(mockActions);
      expect(result.view).toEqual({
        counter: mockCounterView,
        button: mockButtonView,
      });
    });
  });

  describe('extendComponent', async () => {
    // Import modules once at the describe level
    const { isComponentFactory, brandWithSymbol } = await import(
      '../shared/identify'
    );
    const { MODEL_FACTORY_BRAND, COMPONENT_FACTORY_BRAND, LATTICE_BRAND } =
      await import('../shared/types');

    // Create a mock component factory
    const mockLattice = brandWithSymbol(
      {
        getModel: vi.fn(),
        getSelectors: vi.fn(),
        getActions: vi.fn(),
        getView: vi.fn(),
        getAllViews: vi.fn(),
      },
      LATTICE_BRAND
    );

    // Create a properly typed mock component factory
    const mockComponentFactory = brandWithSymbol(
      () =>
        mockLattice as unknown as Lattice<
          unknown,
          unknown,
          unknown,
          Record<string, unknown>
        >,
      COMPONENT_FACTORY_BRAND
    ) as unknown as ComponentFactory<
      unknown,
      unknown,
      unknown,
      Record<string, unknown>
    >;

    it('should create a new component factory', () => {
      // Create a callback that returns extensions
      const callback = ((_: any) => ({
        // Return minimal extensions
        model: brandWithSymbol(() => (_: any) => ({}), MODEL_FACTORY_BRAND),
      })) as any;

      // Call extendComponent
      const extendedFactory = extendComponent(mockComponentFactory, callback);

      // Should be a component factory
      expect(isComponentFactory(extendedFactory)).toBe(true);
    });
  });
}
