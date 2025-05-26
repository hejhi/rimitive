import {
  VIEW_TOOLS_BRAND,
  VIEW_FACTORY_BRAND,
  ViewSliceFactory,
  ViewFactoryParams,
  ViewFactory,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a view factory.
 *
 * This is the primary API for creating views in Lattice. Use it to define your
 * view's projections and values from selectors and actions. For composition, use the fluent compose API.
 *
 * @param params Object containing selectors and actions to be used
 * @param factory Function that produces a view object with projections and values
 * @returns A view instance function that can be used with compose
 */
export function createView<T, TSelectors = unknown, TActions = unknown>(
  params: { selectors?: TSelectors; actions?: TActions },
  factory: ViewSliceFactory<T, TSelectors, TActions>
): ViewFactory<T, TSelectors, TActions> {
  return brandWithSymbol(function viewFactory<S extends Partial<T> = T>(
    selector?: (base: T) => S
  ) {
    return (options: ViewFactoryParams<TSelectors, TActions>) => {
      // Ensure the required properties exist
      if (!options.selectors || !options.actions) {
        throw new Error(
          'View factory requires selectors and actions functions'
        );
      }

      // Call the factory with object parameters to match the spec
      const result = factory(brandWithSymbol(options, VIEW_TOOLS_BRAND));

      // If a selector is provided, apply it to filter properties
      if (selector) return selector(result);

      // Otherwise return the full result
      return result as unknown as S;
    };
  }, VIEW_FACTORY_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createView', async () => {
    const { isViewFactory } = await import('../shared/identify');
    const { createMockTools, mockImplementations } = await import(
      '../test-utils'
    );

    it('should verify view factory requirements and branding', () => {
      // Use standardized mock implementations
      const mockSelectors = {
        count: 42,
        isPositive: true,
      };

      const mockActions = mockImplementations.counterActions();

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

      // Use standardized mock tools
      const mockTools = createMockTools({
        selectors: () => mockSelectors,
        actions: () => mockActions,
      });

      // Create a slice with the proper params
      const sliceCreator = view();
      const slice = sliceCreator(mockTools);

      // Factory should be called with object parameters
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectors: expect.any(Function),
          actions: expect.any(Function),
        })
      );

      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(toolsObj).toBeDefined();
      expect(toolsObj).toHaveProperty('selectors');
      expect(toolsObj).toHaveProperty('actions');
      expect(typeof toolsObj!.selectors).toBe('function');
      expect(typeof toolsObj!.actions).toBe('function');

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
  });
}
