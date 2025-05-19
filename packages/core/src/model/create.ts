import {
  MODEL_TOOLS_BRAND,
  MODEL_FACTORY_BRAND,
  ModelSliceFactory,
  StoreFactoryTools
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a model factory.
 *
 * This is the primary API for creating models in Lattice. Use it to define your
 * model's state, actions, and derived values.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterModel = createModel(({ get, set }) => ({
 *   count: 0,
 *   increment: () => set(state => ({ count: state.count + 1 })),
 *   decrement: () => set(state => ({ count: state.count - 1 })),
 *   reset: () => set({ count: 0 }),
 *   doubleCount: () => get().count * 2
 * }));
 *
 * // With composition
 * const enhancedModel = createModel(
 *   compose(counterModel).with((tools) => ({
 *     incrementTwice: () => {
 *       tools.get().increment();
 *       tools.get().increment();
 *     }
 *   }))
 * );
 *
 * // With selective property inclusion
 * const filteredModel = createModel(
 *   compose(counterModel).with((tools) => ({
 *     // increment, decrement, and reset are omitted
 *     tripleCount: () => tools.get().count * 3, // Add a new property
 *   }))
 * );
 * ```
 *
 * @param sliceFactory A function that produces a state object with optional methods and derived properties
 * @returns A model factory function that can be composed
 */
export function createModel<T>(sliceFactory: ModelSliceFactory<T>) {
  // Create a factory function that returns a slice creator
  const modelFactory = function modelFactory<S extends Partial<T> = T>(selector?: (base: T) => S) {
    return (options: StoreFactoryTools<T>) => {
      // Ensure the required properties exist
      if (!options.get || !options.set) {
        throw new Error('Model factory requires get and set functions');
      }

      // Create a branded tools object for the factory
      const tools = brandWithSymbol(
        {
          set: options.set,
          get: options.get,
        },
        MODEL_TOOLS_BRAND
      );

      // Call the factory with object parameters to match the spec
      const result = sliceFactory(tools);
      
      // If a selector is provided, apply it to filter properties
      if (selector) {
        return selector(result) as S;
      }
      
      // Otherwise return the full result
      return result as unknown as S;
    };
  };

  return brandWithSymbol(modelFactory, MODEL_FACTORY_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createModel', async () => {
    const { isModelFactory, isModelTools } = await import(
      '../shared/identify'
    );

    it('should verify model factory requirements and branding', () => {
      // Create a spy factory with object parameters
      const factorySpy = vi.fn((_tools) => ({
        count: 1,
      }));

      const model = createModel(factorySpy);

      // Model should be a function
      expect(typeof model).toBe('function');

      expect(isModelFactory(model)).toBe(true);

      // Create tools for testing
      const mockSet = vi.fn();
      const mockGet = vi.fn();

      // Create a slice with the mock tools
      const sliceCreator = model();
      const slice = sliceCreator({ get: mockGet, set: mockSet });

      // Factory should be called with object parameters
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          set: mockSet,
          get: mockGet,
        })
      );

      // The tools should be branded with the proper symbol
      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(isModelTools(toolsObj)).toBe(true);

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
