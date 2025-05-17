import {
  ComponentConfig,
  WithComponentCallback,
  ComponentFactory,
  ComponentElements,
  ModelInstance,
  SelectorsInstance,
  ActionsInstance,
  ViewInstance,
} from '../shared/types';
import { createComponent } from './create';

/**
 * Composes a component with extensions.
 *
 * This function enables composition of components, allowing selective extension or replacement
 * of component parts (model, selectors, actions, views).
 *
 * @example
 * ```typescript
 * const enhancedComponent = createComponent(
 *   withComponent(counterComponent, ({ model, view, actions, selectors }) => {
 *     // Enhance the model with new functionality
 *     const _model = createModel(
 *       compose(model).with(({ get, set }) => ({
 *         incrementTwice: () => {
 *           get().increment();
 *           get().increment();
 *         },
 *         reset: () => set({ count: 0 })
 *       }))
 *     );
 *
 *     // Enhance other components...
 *
 *     return {
 *       model: _model,
 *       // Other components...
 *     };
 *   })
 * );
 * ```
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
  TExtViews extends TBaseViews
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
    const elements: ComponentElements<
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
    const result: ComponentConfig<TExtModel, TExtSelectors, TExtActions, TExtViews> = {
      model: (extensions.model || component.getModel()) as ModelInstance<TExtModel>,
      selectors: (extensions.selectors || component.getSelectors()) as SelectorsInstance<TExtSelectors>,
      actions: (extensions.actions || component.getActions()) as ActionsInstance<TExtActions>,
      view: (extensions.view || component.getAllViews()) as {
        [K in keyof TExtViews]: ViewInstance<TExtViews[K]>;
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
 * @example
 * ```typescript
 * const enhancedComponent = extendComponent(baseComponent, ({ model, selectors }) => {
 *   const _model = createModel(
 *     compose(model).with(({ get, set }) => ({
 *       reset: () => set({ count: 0 })
 *     }))
 *   );
 *
 *   return {
 *     model: _model,
 *   };
 * });
 * ```
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
  TExtViews extends TBaseViews
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
      MODEL_INSTANCE_BRAND,
      SELECTORS_INSTANCE_BRAND,
      ACTIONS_INSTANCE_BRAND,
      VIEW_INSTANCE_BRAND,
      LATTICE_BRAND,
      COMPONENT_FACTORY_BRAND,
    } = await import('../shared/types');

    // Create mock components for all tests in this describe block
    const mockModel = brandWithSymbol(() => ({}), MODEL_INSTANCE_BRAND);
    const mockSelectors = brandWithSymbol(() => ({}), SELECTORS_INSTANCE_BRAND);
    const mockActions = brandWithSymbol(() => ({}), ACTIONS_INSTANCE_BRAND);
    const mockCounterView = brandWithSymbol(() => ({}), VIEW_INSTANCE_BRAND);
    const mockButtonView = brandWithSymbol(() => ({}), VIEW_INSTANCE_BRAND);

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

    const mockComponentFactory = brandWithSymbol(
      () => mockLattice,
      COMPONENT_FACTORY_BRAND
    );

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
      // Create extensions
      const extModel = brandWithSymbol(() => ({}), MODEL_INSTANCE_BRAND);
      const extSelectors = brandWithSymbol(
        () => ({}),
        SELECTORS_INSTANCE_BRAND
      );
      const extActions = brandWithSymbol(() => ({}), ACTIONS_INSTANCE_BRAND);
      const extCounterView = brandWithSymbol(() => ({}), VIEW_INSTANCE_BRAND);
      const extResetView = brandWithSymbol(() => ({}), VIEW_INSTANCE_BRAND);

      // Create a callback that returns extensions with the views properly typed
      const callback = () => ({
        model: extModel,
        selectors: extSelectors,
        actions: extActions,
        view: {
          counter: extCounterView, // Override existing view
          reset: extResetView, // Add new view
        } as { counter: ViewInstance<unknown>; reset: ViewInstance<unknown>; },
      });

      // Call withComponent
      const factory = withComponent(mockComponentFactory, callback);
      const result = factory();

      // Ensure extensions were returned correctly
      expect(result.model).toBe(extModel);
      expect(result.selectors).toBe(extSelectors);
      expect(result.actions).toBe(extActions);
      expect(result.view?.counter).toBe(extCounterView);
      expect(result.view?.reset).toBe(extResetView);
    });

    it('should use base components when extensions are not provided', () => {
      // Create a callback that returns partial extensions
      const extModel = brandWithSymbol(() => ({}), MODEL_INSTANCE_BRAND);
      const callback = () => ({
        // Only extend the model
        model: extModel,
      });

      // Call withComponent
      const factory = withComponent(mockComponentFactory, callback);
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
    const { MODEL_INSTANCE_BRAND, COMPONENT_FACTORY_BRAND, LATTICE_BRAND } =
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

    const mockComponentFactory = brandWithSymbol(
      () => mockLattice,
      COMPONENT_FACTORY_BRAND
    );

    it('should create a new component factory', () => {
      // Create a callback that returns extensions
      const callback = () => ({
        // Return minimal extensions
        model: brandWithSymbol(() => ({}), MODEL_INSTANCE_BRAND),
      });

      // Call extendComponent
      const extendedFactory = extendComponent(mockComponentFactory, callback);

      // Should be a component factory
      expect(isComponentFactory(extendedFactory)).toBe(true);
    });
  });
}
