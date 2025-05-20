import {
  VIEW_TOOLS_BRAND,
  VIEW_FACTORY_BRAND,
  ViewSliceFactory,
  ViewFactoryParams,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a view factory.
 *
 * This is the primary API for creating views in Lattice. Use it to define your
 * view's projections and values from selectors and actions. For composition, use the fluent compose API.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterView = createView({ selectors, actions }, ({ selectors, actions }) => ({
 *   "data-count": selectors().count,
 *   "aria-live": "polite",
 *   onClick: actions().increment,
 *   onKeyDown: (event) => {
 *     if (event.key === 'Enter') {
 *       actions().increment();
 *     }
 *   }
 * }));
 * ```
 *
 * @param params Object containing selectors and actions to be used
 * @param factory Function that produces a view object with projections and values
 * @returns A view instance function that can be used with compose
 */
export function createView<T, TSelectors = unknown, TActions = unknown>(
  params: { selectors?: TSelectors; actions?: TActions },
  factory: ViewSliceFactory<T, TSelectors, TActions>
) {
  // Create a factory function that returns a slice creator
  const viewFactory = function viewFactory<S extends Partial<T> = T>(
    selector?: (base: T) => S
  ) {
    return (options: ViewFactoryParams<TSelectors, TActions>) => {
      // Ensure the required properties exist
      if (!options.selectors || !options.actions) {
        throw new Error(
          'View factory requires selectors and actions functions'
        );
      }

      // Validate selectors and actions if they're used in the factory
      if (
        params.selectors === undefined &&
        factory.toString().includes('selectors()')
      ) {
        throw new Error(
          'View factory is using selectors() but no selectors were provided'
        );
      }

      if (
        params.actions === undefined &&
        factory.toString().includes('actions()')
      ) {
        throw new Error(
          'View factory is using actions() but no actions were provided'
        );
      }

      // Create branded tools object with access functions for the factory
      const tools = brandWithSymbol(
        {
          selectors: () => {
            if (params.selectors === undefined) {
              throw new Error(
                'Attempting to access selectors that were not provided to createView'
              );
            }
            return params.selectors;
          },
          actions: () => {
            if (params.actions === undefined) {
              throw new Error(
                'Attempting to access actions that were not provided to createView'
              );
            }
            return params.actions;
          },
        },
        VIEW_TOOLS_BRAND
      );

      // Call the factory with object parameters to match the spec
      const result = factory(tools);

      // If a selector is provided, apply it to filter properties
      if (selector) {
        return selector(result) as S;
      }

      // Otherwise return the full result
      return result as unknown as S;
    };
  };

  return brandWithSymbol(viewFactory, VIEW_FACTORY_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createView', async () => {
    const { isViewFactory, isViewTools } = await import('../shared/identify');

    it('should verify view factory requirements and branding', () => {
      // Create mock selectors and actions
      const mockSelectors = {
        count: 42,
        isPositive: true,
      };

      const mockActions = {
        increment: vi.fn(),
        reset: vi.fn(),
      };

      // Create a spy factory with object parameters
      const factorySpy = vi.fn(
        ({
          selectors,
          actions,
        }: ViewFactoryParams<typeof mockSelectors, typeof mockActions>) => ({
          'data-count': selectors().count,
          'aria-positive': selectors().isPositive,
          onClick: actions().increment,
          onReset: actions().reset,
        })
      );

      const view = createView(
        { selectors: mockSelectors, actions: mockActions },
        factorySpy
      );

      // View should be a function
      expect(typeof view).toBe('function');

      expect(isViewFactory(view)).toBe(true);

      // Create a slice with the proper params
      const sliceCreator = view();
      const slice = sliceCreator({
        selectors: () => mockSelectors,
        actions: () => mockActions,
      });

      // Factory should be called with object parameters
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectors: expect.any(Function),
          actions: expect.any(Function),
        })
      );

      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(isViewTools(toolsObj)).toBe(true);

      // Verify slice contains the expected values
      expect(slice).toEqual({
        'data-count': 42,
        'aria-positive': true,
        onClick: mockActions.increment,
        onReset: mockActions.reset,
      });

      // Ensure selectors and actions functions return the correct values
      expect(factorySpy.mock.calls[0]?.[0].selectors()).toBe(mockSelectors);
      expect(factorySpy.mock.calls[0]?.[0].actions()).toBe(mockActions);
    });

    it('should throw an error when required tools are missing', () => {
      const view = createView({}, () => ({ count: 1 }));
      const sliceCreator = view();

      // Should throw when selectors or actions are missing
      // @ts-expect-error
      expect(() => sliceCreator({})).toThrow(
        'View factory requires selectors and actions functions'
      );

      expect(() =>
        // @ts-expect-error
        sliceCreator({ actions: () => ({}) })
      ).toThrow('View factory requires selectors and actions functions');
    });

    it('should throw an error when accessing selectors that were not provided', () => {
      // Create a view that tries to use selectors without providing them
      const view = createView({}, ({ selectors }) => ({
        // @ts-expect-error
        value: selectors().count, // This should throw
      }));

      const sliceCreator = view();

      // Should throw when trying to access unavailable selectors
      expect(() =>
        sliceCreator({
          selectors: () => ({}),
          actions: () => ({}),
        })
      ).toThrow(
        'View factory is using selectors() but no selectors were provided'
      );
    });

    it('should throw an error when accessing actions that were not provided', () => {
      // Create a view that tries to use actions without providing them
      const view = createView({}, ({ actions }) => ({
        // @ts-expect-error
        handler: actions().increment, // This should throw
      }));

      const sliceCreator = view();

      // Should throw when trying to access unavailable actions
      expect(() =>
        sliceCreator({
          selectors: () => ({}),
          actions: () => ({}),
        })
      ).toThrow('View factory is using actions() but no actions were provided');
    });

    it('should check for selectors and actions usage at creation time', () => {
      // Should throw when using selectors without providing them
      expect(() => {
        const viewFactory = createView(
          {}, // No selectors
          ({ selectors }) => ({
            // @ts-expect-error
            value: selectors().count, // This reference will be detected
          })
        );

        const sliceCreator = viewFactory();
        sliceCreator({ selectors: () => ({}), actions: () => ({}) }); // This should throw
      }).toThrow();

      // Should throw when using actions without providing them
      expect(() => {
        const viewFactory = createView(
          {}, // No actions
          ({ actions }) => ({
            // @ts-expect-error
            handler: actions().increment, // This reference will be detected
          })
        );

        const sliceCreator = viewFactory();
        sliceCreator({ selectors: () => ({}), actions: () => ({}) }); // This should throw
      }).toThrow();
    });

    // Note: Full view composition tests with cherry-picking will be added when the component
    // infrastructure is implemented. For now we're testing function-access patterns
    // and object parameters, which are the focus of this PR.
    it.todo('should support cherry-picking properties in composition');
  });
}
