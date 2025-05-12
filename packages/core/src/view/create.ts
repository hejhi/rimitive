import {
  VIEW_FACTORY_BRAND,
  VIEW_INSTANCE_BRAND,
  ViewFactory,
  ViewFactoryTools,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a view factory.
 *
 * This is the primary API for creating views in Lattice. Use it to define your
 * view's projections and derived values from models and actions. For composition, use the fluent compose API.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterView = createView(({ derive, dispatch }) => ({
 *   doubleCount: () => derive(counterModel, 'count') * 2,
 *   increment: () => dispatch(counterActions, 'increment')(),
 *   formattedCount: () => `Count: ${derive(counterModel, 'count')}`
 * }));
 *
 * // With composition
 * const enhancedView = compose(counterView).with<{ isPositive: () => boolean }>(
 *   ({ derive }) => ({
 *     isPositive: () => derive(counterModel, 'count') > 0,
 *   })
 * );
 *
 * // Prepare for use
 * const preparedView = prepare(enhancedView);
 * ```
 *
 * @param factory A function that produces a view object with projections and derived values
 * @returns A view instance function that can be used with compose and prepare
 */
export function createView<T>(factory: ViewFactory<T>) {
  // Create a factory function that returns a slice creator
  const viewFactory = function viewFactory() {
    return (options: ViewFactoryTools) => {
      // Ensure the required properties exist
      if (!options.derive || !options.dispatch) {
        throw new Error('View factory requires derive and dispatch functions');
      }

      // Call the factory with the tools
      return factory(
        brandWithSymbol(
          {
            derive: options.derive,
            dispatch: options.dispatch,
          },
          VIEW_FACTORY_BRAND
        )
      );
    };
  };

  return brandWithSymbol(viewFactory, VIEW_INSTANCE_BRAND);
}

if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createView', async () => {
    const { isViewInstance, isViewFactory } = await import(
      '../shared/identify'
    );

    it('should verify view factory requirements and branding', () => {
      // Create a spy factory
      const factorySpy = vi.fn((_: ViewFactoryTools) => ({
        count: 1,
      }));

      const view = createView(factorySpy);

      // View should be a function
      expect(typeof view).toBe('function');
      expect(isViewInstance(view)).toBe(true);

      // Create tools for testing
      const mockDerive = vi.fn();
      const mockDispatch = vi.fn();

      // Create a slice with the mock tools
      const sliceCreator = view();
      const slice = sliceCreator({
        derive: mockDerive,
        dispatch: mockDispatch,
      });

      // Factory should be called with the tools
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          derive: mockDerive,
          dispatch: mockDispatch,
        })
      );

      const toolsObj = (factorySpy.mock.calls[0] as any)[0];
      expect(isViewFactory(toolsObj)).toBe(true);

      // Verify slice contains the expected value
      expect(slice).toEqual({ count: 1 });
    });

    it('should throw an error when required tools are missing', () => {
      const view = createView(() => ({ count: 1 }));
      const sliceCreator = view();

      // Should throw when derive or dispatch are missing
      expect(() => sliceCreator({} as any)).toThrow(
        'View factory requires derive and dispatch functions'
      );
      expect(() =>
        sliceCreator({ derive: undefined, dispatch: vi.fn() } as any)
      ).toThrow('View factory requires derive and dispatch functions');
      expect(() =>
        sliceCreator({ derive: vi.fn(), dispatch: undefined } as any)
      ).toThrow('View factory requires derive and dispatch functions');
    });

    it('should support the derive and dispatch functions', () => {
      // Create a mock model and actions to derive from and dispatch to
      type MockModel = { count: number; computed: number };
      const mockModel: MockModel = {
        count: 10,
        computed: 20,
      };
      const mockActions = {
        increment: vi.fn(() => 42),
      };

      // Setup the derive and dispatch functions (mock)
      const mockDerive = vi.fn(<M, K extends keyof M>(model: M, key: K) => {
        return model[key];
      });
      const mockDispatch = vi.fn(<A, K extends keyof A>(actions: A, key: K) => {
        return (...args: any[]) => (actions[key] as any)(...args);
      });

      const view = createView<{
        derivedCount: number;
        incrementResult: number;
        combinedCount: number;
      }>(({ derive, dispatch }) => ({
        derivedCount: derive(mockModel, 'count'),
        incrementResult: dispatch(mockActions, 'increment')(),
        combinedCount: derive(mockModel, 'computed'),
      }));

      const sliceCreator = view();
      const slice = sliceCreator({
        derive: mockDerive,
        dispatch: mockDispatch as any,
      });

      // Verify derive and dispatch were called
      expect(mockDerive).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalled();

      // Verify the derived and dispatched values
      expect(slice.derivedCount).toBe(10);
      expect(slice.incrementResult).toBe(42);
      expect(slice.combinedCount).toBe(20);
    });

    it('should work with the fluent compose API', async () => {
      const { compose } = await import('../shared/compose/fluent');

      // Create a base view
      const baseView = createView<{
        count: number;
        isPositive: () => boolean;
      }>(({ derive }) => ({
        count: derive({ count: 0 }, 'count'),
        isPositive: () => derive({ count: 0 }, 'count') > 0,
      }));

      // Compose them using fluent compose
      const enhancedView = compose(baseView).with<{
        doubled: () => number;
        formattedCount: () => string;
      }>(({ derive }) => ({
        doubled: () => derive({ count: 5 }, 'count') * 2,
        formattedCount: () => `Count: ${derive({ count: 5 }, 'count')}`,
      }));

      // View should be a function
      expect(typeof enhancedView).toBe('function');

      // mockDerive returns all properties expected by the composed view
      const mockDerive = vi.fn((model: any, key: any) => model[key]);
      const mockDispatch = vi.fn(
        (actions: any, key: any) =>
          (...args: any[]) =>
            actions[key](...args)
      );

      // Create a slice with mock tools
      const sliceCreator = enhancedView();
      const slice = sliceCreator({
        derive: mockDerive,
        dispatch: mockDispatch as any,
      });

      // Should have both the base and extension properties
      expect(slice).toHaveProperty('count');
      expect(slice).toHaveProperty('isPositive');
      expect(slice).toHaveProperty('doubled');
      expect(slice).toHaveProperty('formattedCount');

      // Test the extension methods
      expect(slice.isPositive()).toBe(false);
      expect(slice.doubled()).toBe(10);
      expect(slice.formattedCount()).toBe('Count: 5');
    });

    it('should work with the prepare API', async () => {
      const { prepare, isPrepared } = await import('../shared/compose/prepare');

      // Create a view
      const view = createView<{ count: number; isPositive: () => boolean }>(
        ({ derive }) => ({
          count: derive({ count: 0 }, 'count'),
          isPositive: () => derive({ count: 0 }, 'count') > 0,
        })
      );

      // Prepare it
      const preparedView = prepare(view);

      // Should be a function
      expect(typeof preparedView).toBe('function');

      // Should be prepared
      expect(isPrepared(preparedView)).toBe(true);

      // mockDerive returns all properties expected by the prepared view
      const mockDerive = vi.fn((model: any, key: any) => model[key]);
      const mockDispatch = vi.fn(
        (actions: any, key: any) =>
          (...args: any[]) =>
            actions[key](...args)
      );

      // Should still work as a view
      const sliceCreator = preparedView();
      const slice = sliceCreator({
        derive: mockDerive,
        dispatch: mockDispatch as any,
      });

      // Test functionality
      expect(slice.count).toBe(0);
      expect(slice.isPositive()).toBe(false);
    });
  });
}
