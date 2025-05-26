import {
  MODEL_TOOLS_BRAND,
  MODEL_FACTORY_BRAND,
  ModelSliceFactory,
  ModelFactoryParams,
  ModelFactory,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a model factory.
 *
 * This is the primary API for creating models in Lattice. Use it to define your
 * model's state, actions, and derived values.
 *
 * @param sliceFactory A function that produces a state object with optional methods and derived properties
 * @returns A model factory function that can be composed
 */
export function createModel<TModel>(
  sliceFactory: ModelSliceFactory<TModel>
): ModelFactory<TModel> {
  return brandWithSymbol(function modelFactory<
    S extends Partial<TModel> = TModel,
  >(selector?: (base: TModel) => S) {
    return (options: ModelFactoryParams<TModel>) => {
      // Ensure the required properties exist
      if (!options.get || !options.set) {
        throw new Error('Model factory requires get and set functions');
      }

      // Call the factory with object parameters to match the spec
      const result = sliceFactory(brandWithSymbol(options, MODEL_TOOLS_BRAND));

      // If a selector is provided, apply it to filter properties
      if (selector) return selector(result);

      // Otherwise return the full result
      return result as unknown as S;
    };
  }, MODEL_FACTORY_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createModel', async () => {
    const { isModelFactory } = await import('../shared/identify');
    const { createMockTools } = await import('../test-utils');

    it('should verify model factory requirements and branding', () => {
      // Create a spy factory with object parameters
      const factorySpy = vi.fn((_tools) => ({
        count: 1,
      }));

      const model = createModel(factorySpy);

      // Model should be a function
      expect(typeof model).toBe('function');

      expect(isModelFactory(model)).toBe(true);

      // Use standardized mock tools
      const mockTools = createMockTools({
        get: vi.fn(),
        set: vi.fn(),
      });

      // Create a slice with the mock tools
      const sliceCreator = model();
      const slice = sliceCreator(mockTools);

      // Factory should be called with object parameters
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          set: expect.any(Function),
          get: expect.any(Function),
        })
      );

      // The tools should be properly structured
      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(toolsObj).toHaveProperty('set');
      expect(toolsObj).toHaveProperty('get');
      expect(typeof toolsObj.set).toBe('function');
      expect(typeof toolsObj.get).toBe('function');

      // Verify slice contains the expected value
      expect(slice).toEqual({ count: 1 });
    });

    it('should throw an error when required tools are missing', () => {
      const model = createModel(() => ({ count: 1 }));
      const sliceCreator = model();

      // Should throw when get or set are missing
      // @ts-expect-error
      expect(() => sliceCreator({})).toThrow(
        'Model factory requires get and set functions'
      );

      // @ts-expect-error
      expect(() => sliceCreator({ get: undefined, set: vi.fn() })).toThrow(
        'Model factory requires get and set functions'
      );

      // @ts-expect-error
      expect(() => sliceCreator({ get: vi.fn(), set: undefined })).toThrow(
        'Model factory requires get and set functions'
      );
    });
  });
}
