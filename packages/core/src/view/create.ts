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

      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(isViewFactory(toolsObj)).toBe(true);

      // Verify slice contains the expected value
      expect(slice).toEqual({ count: 1 });
    });

    it('should throw an error when required tools are missing', () => {
      const view = createView(() => ({ count: 1 }));
      const sliceCreator = view();

      // Should throw when derive or dispatch are missing
      // @ts-expect-error
      expect(() => sliceCreator({})).toThrow(
        'View factory requires derive and dispatch functions'
      );

      expect(() =>
        // @ts-expect-error
        sliceCreator({ derive: undefined, dispatch: vi.fn() })
      ).toThrow('View factory requires derive and dispatch functions');

      expect(() =>
        // @ts-expect-error
        sliceCreator({ derive: vi.fn(), dispatch: undefined })
      ).toThrow('View factory requires derive and dispatch functions');
    });
  });
}
