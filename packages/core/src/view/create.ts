import {
  VIEW_FACTORY_BRAND,
  VIEW_INSTANCE_BRAND,
  ViewFactory,
  SelectFactoryTools,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a view factory.
 *
 * This is the primary API for creating views in Lattice. Use it to define your
 * view's projections and values from models and actions. For composition, use the fluent compose API.
 *
 * @param factory A function that produces a view object with projections and values
 * @returns A view instance function that can be used with compose
 */
export function createView<T>(factory: ViewFactory<T>) {
  // Create a factory function that returns a slice creator
  const viewFactory = function viewFactory() {
    return (options: SelectFactoryTools<T>) => {
      // Ensure the required properties exist
      if (!options.get) {
        throw new Error('View factory requires a get function');
      }

      // Call the factory with the tools
      return factory(brandWithSymbol({ get: options.get }, VIEW_FACTORY_BRAND));
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
      const factorySpy = vi.fn((_: SelectFactoryTools<{ count: number }>) => ({
        count: 1,
      }));

      const view = createView(factorySpy);

      // View should be a function
      expect(typeof view).toBe('function');

      expect(isViewInstance(view)).toBe(true);

      // Create tools for testing
      const mockGet = vi.fn();

      // Create a slice with the mock tools
      const sliceCreator = view();
      const slice = sliceCreator({ get: mockGet });

      // Factory should be called with the tools
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          get: mockGet,
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

      // Should throw when get or set are missing
      // @ts-expect-error
      expect(() => sliceCreator({})).toThrow(
        'View factory requires a get function'
      );

      // @ts-expect-error
      expect(() => sliceCreator({ get: undefined })).toThrow(
        'View factory requires a get function'
      );
    });
  });
}
