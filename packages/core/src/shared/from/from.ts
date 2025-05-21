/**
 * A fluent API for creating Lattice components with proper type inference.
 *
 * The `from` function provides a much better developer experience by:
 * 1. Requiring only a single type parameter in most cases
 * 2. Preserving type information across the entire chain
 * 3. Providing a readable, chainable API
 *
 * Each overload of `from` provides context-appropriate methods based on what was passed to it.
 */

import { createActions } from '../../actions/create';
import { createSelectors } from '../../selectors/create';
import { createView } from '../../view/create';
import { isModelFactory, isSelectorsFactory } from '../identify';
import {
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
  ActionsSliceFactory,
  ActionsFactoryParams,
  SelectorsFactoryParams,
} from '../types';

/**
 * Type overloads for the from function
 */

/**
 * Creates a fluent API from a model factory.
 * This provides methods for creating actions and selectors with full type inference.
 */
export function from<TModel>(source: ModelFactory<TModel>): {
  createActions<TActions>(
    factory: ActionsSliceFactory<TActions, TModel>
  ): ActionsFactory<TActions, TModel>;

  createSelectors<TSelectors>(
    factory: (tools: { model: () => TModel }) => TSelectors
  ): SelectorsFactory<TSelectors>;
};

/**
 * Creates a fluent API from a selectors factory.
 * This provides methods for working with selectors and creating views.
 */
export function from<TSelectors>(source: SelectorsFactory<TSelectors>): {
  withActions<TActions, TModel>(
    actions: ActionsFactory<TActions, TModel>
  ): {
    createView<TView>(
      factory: (tools: {
        selectors: () => TSelectors;
        actions: () => TActions;
      }) => TView
    ): ViewFactory<TView, TSelectors, TActions>;
  };
};

/**
 * Type guard and implementation to determine which overload to use at runtime.
 */
export function from(source: any): any {
  if (isModelFactory(source)) return fromModel(source);
  if (isSelectorsFactory(source)) return fromSelectors(source);

  // Fallback for other types, could be expanded as needed
  throw new Error('Unsupported source type for from()');
}

// Private implementation helpers
function fromModel<TModel>(model: ModelFactory<TModel>) {
  return {
    createActions<TActions>(
      factory: (tools: ActionsFactoryParams<TModel>) => TActions
    ) {
      // Use proper type parameters to maintain type safety
      return createActions<TActions, ModelFactory<TModel>>(
        { model },
        // Cast to the correct type to ensure compatibility
        (tools) =>
          factory({
            model: () => tools.model() as TModel,
          })
      );
    },

    createSelectors<TSelectors>(
      factory: (tools: SelectorsFactoryParams<TModel>) => TSelectors
    ) {
      // Use proper type parameters to maintain type safety
      return createSelectors<TSelectors, ModelFactory<TModel>>(
        { model },
        // Cast to the correct type to ensure compatibility
        (tools) =>
          factory({
            model: () => tools.model() as TModel,
          })
      );
    },
  };
}

function fromSelectors<TSelectors>(selectors: SelectorsFactory<TSelectors>) {
  return {
    withActions<TActions>(actions: ActionsFactory<TActions>) {
      return {
        createView<TView>(
          factory: (tools: {
            selectors: () => TSelectors;
            actions: () => TActions;
          }) => TView
        ) {
          // Following the same pattern as createActions and createSelectors,
          // we pass the factories directly without unwrapping
          return createView<
            TView,
            SelectorsFactory<TSelectors>,
            ActionsFactory<TActions>
          >(
            {
              selectors,
              actions,
            },
            // The factory is wrapped to match the expected signature
            (tools) =>
              factory({
                selectors: () => tools.selectors() as TSelectors,
                actions: () => tools.actions() as TActions,
              })
          );
        },
      };
    },
  };
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('from() API', async () => {
    // Import test utilities
    const {
      createMockModel,
      createMockSelectors,
      createMockActions,
      createMockTools,
    } = await import('../../test-utils');
    
    const {
      ACTIONS_FACTORY_BRAND,
      SELECTORS_FACTORY_BRAND,
      VIEW_FACTORY_BRAND,
    } = await import('../types');

    describe('from() type guard and dispatch', () => {
      it('should dispatch to fromModel for model factories', () => {
        const mockModel = createMockModel({ count: 0 });
        const result = from(mockModel);

        // Should have model factory methods
        expect(typeof result.createActions).toBe('function');
        expect(typeof result.createSelectors).toBe('function');
      });

      it('should dispatch to fromSelectors for selectors factories', () => {
        const mockSelectors = createMockSelectors({ value: 'test' });
        const result = from(mockSelectors);

        // Should have selectors factory methods
        expect(typeof result.withActions).toBe('function');
      });

      it('should throw error for unsupported source types', () => {
        // @ts-expect-error - Testing with invalid types
        expect(() => from({})).toThrow('Unsupported source type for from()');
        // @ts-expect-error - Testing with invalid types
        expect(() => from(null)).toThrow('Unsupported source type for from()');
        // @ts-expect-error - Testing with invalid types
        expect(() => from('string')).toThrow('Unsupported source type for from()');
        // @ts-expect-error - Testing with invalid types
        expect(() => from(42)).toThrow('Unsupported source type for from()');
      });
    });

    describe('fromModel() functionality', () => {
      it('should create actions with proper model access', () => {
        const mockModel = createMockModel({ count: 0, increment: vi.fn() });
        const result = from(mockModel);

        const actionsSpy = vi.fn(({ model }) => ({
          inc: model().increment,
          getCount: () => model().count,
        }));

        const actions = result.createActions(actionsSpy);

        // Verify actions factory was created and properly branded
        expect(actions).toBeDefined();
        expect((actions as any)[ACTIONS_FACTORY_BRAND]).toBe(true);

        // Use standardized mock tools
        const mockTools = createMockTools({
          model: () => ({ count: 0, increment: vi.fn() }),
        });
        
        const actionCreator = actions();
        actionCreator(mockTools as any);
        
        // Verify the factory was called with model access
        expect(actionsSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.any(Function),
          })
        );
      });

      it('should create selectors with proper model access', () => {
        const mockModel = createMockModel({ count: 5 });
        const result = from(mockModel);

        const selectorsSpy = vi.fn(({ model }) => ({
          count: model().count,
          isPositive: model().count > 0,
        }));

        const selectors = result.createSelectors(selectorsSpy);

        // Verify selectors factory was created and properly branded
        expect(selectors).toBeDefined();
        expect((selectors as any)[SELECTORS_FACTORY_BRAND]).toBe(true);

        // Use standardized mock tools
        const mockTools = createMockTools({
          model: () => ({ count: 5 }),
        });
        
        const selectorCreator = selectors();
        selectorCreator(mockTools as any);

        // Verify the factory was called with model access
        expect(selectorsSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.any(Function),
          })
        );
      });
    });

    describe('fromSelectors() functionality', () => {
      it('should provide withActions method that returns view creation API', () => {
        const mockSelectors = createMockSelectors({ value: 'test' });
        const mockActions = createMockActions({ doSomething: vi.fn() });

        const result = from(mockSelectors);
        const withActionsResult = result.withActions(mockActions);

        // Should have createView method
        expect(typeof withActionsResult.createView).toBe('function');
      });

      it('should create views with proper selectors and actions access', () => {
        const mockSelectors = createMockSelectors({ value: 'test' });
        const mockActions = createMockActions({ doSomething: vi.fn() });

        const result = from(mockSelectors);
        const withActionsResult = result.withActions(mockActions);

        const viewSpy = vi.fn(({ selectors, actions }) => ({
          'data-value': selectors().value,
          onClick: actions().doSomething,
        }));

        const view = withActionsResult.createView(viewSpy);

        // Verify view factory was created and properly branded
        expect(view).toBeDefined();
        expect((view as any)[VIEW_FACTORY_BRAND]).toBe(true);

        // Use standardized mock tools
        const mockTools = createMockTools({
          selectors: () => ({ value: 'test' }),
          actions: () => ({ doSomething: vi.fn() }),
        });
        
        const viewCreator = view();
        viewCreator(mockTools as any);

        // Verify the factory was called with selectors and actions access
        expect(viewSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            selectors: expect.any(Function),
            actions: expect.any(Function),
          })
        );
      });
    });

    describe('integration flow', () => {
      it('should support complete from(model) -> actions -> selectors -> view flow', () => {
        // Mock model with methods
        const mockModel = createMockModel({
          count: 0,
          increment: vi.fn(),
          reset: vi.fn(),
        });

        // Create actions from model
        const actions = from(mockModel).createActions(({ model }) => ({
          inc: (model() as any).increment,
          rst: (model() as any).reset,
        }));

        // Create selectors from model
        const selectors = from(mockModel).createSelectors(({ model }) => ({
          count: (model() as any).count,
          isZero: (model() as any).count === 0,
        }));

        // Create view from selectors and actions
        const view = from(selectors)
          .withActions(actions)
          .createView(({ selectors, actions }) => ({
            'data-count': selectors().count,
            'data-zero': selectors().isZero,
            onClick: actions().inc,
            onReset: actions().rst,
          }));

        // All factories should be properly branded
        expect((actions as any)[ACTIONS_FACTORY_BRAND]).toBe(true);
        expect((selectors as any)[SELECTORS_FACTORY_BRAND]).toBe(true);
        expect((view as any)[VIEW_FACTORY_BRAND]).toBe(true);
      });
    });

    describe('error handling and edge cases', () => {
      it('should handle null and undefined gracefully', () => {
        // @ts-expect-error - Testing with invalid types
        expect(() => from(null)).toThrow('Unsupported source type for from()');
        // @ts-expect-error - Testing with invalid types
        expect(() => from(undefined)).toThrow('Unsupported source type for from()');
      });

      it('should handle non-factory objects gracefully', () => {
        const plainObject = { someProperty: 'value' };
        const plainFunction = () => {};
        const plainArray = [1, 2, 3];

        // @ts-expect-error - Testing with invalid types
        expect(() => from(plainObject)).toThrow('Unsupported source type for from()');
        // @ts-expect-error - Testing with invalid types
        expect(() => from(plainFunction)).toThrow('Unsupported source type for from()');
        // @ts-expect-error - Testing with invalid types
        expect(() => from(plainArray)).toThrow('Unsupported source type for from()');
      });

      it('should maintain type safety in the fluent chain', () => {
        const mockModel = createMockModel({ count: 0 });
        const mockSelectors = createMockSelectors({ value: 'test' });
        const mockActions = createMockActions({ doSomething: vi.fn() });

        // These should all compile and work without type errors
        const actions = from(mockModel).createActions(() => ({ test: () => {} }));
        const selectors = from(mockModel).createSelectors(() => ({ test: 'value' }));
        const view = from(mockSelectors)
          .withActions(mockActions)
          .createView(() => ({ 'data-test': 'value' }));

        // Use type assertion for symbol access in tests
        expect((actions as any)[ACTIONS_FACTORY_BRAND]).toBe(true);
        expect((selectors as any)[SELECTORS_FACTORY_BRAND]).toBe(true);
        expect((view as any)[VIEW_FACTORY_BRAND]).toBe(true);
      });
    });
  });
}
