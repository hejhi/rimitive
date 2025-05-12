import {
  MODEL_FACTORY_BRAND,
  MODEL_INSTANCE_BRAND,
  ModelFactory,
  ModelFactoryTools,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a model factory.
 *
 * This is the primary API for creating models in Lattice. Use it to define your
 * model's state, actions, and derived values. For composition, use the composeWith function.
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
 * const enhancedModel = composeWith(counterModel, ({ get, set }) => ({
 *   triple: () => set(state => ({ count: state.count * 3 })),
 *   isPositive: () => get().count > 0
 * }));
 *
 * // Finalize for use
 * const finalModel = instantiate(enhancedModel);
 * ```
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @returns A model instance function that can be used with composeWith and instantiate
 */
export function createModel<T>(factory: ModelFactory<T>) {
  // Create a factory function that returns a slice creator
  const modelFactory = function modelFactory() {
    return (options: ModelFactoryTools<T>) => {
      // Ensure the required properties exist
      if (!options.get || !options.set) {
        throw new Error('Model factory requires get and set functions');
      }

      // Call the factory with the tools
      return factory(
        brandWithSymbol(
          {
            get: options.get,
            set: options.set,
          },
          MODEL_FACTORY_BRAND
        )
      );
    };
  };

  return brandWithSymbol(modelFactory, MODEL_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createModel', async () => {
    const { isModelInstance, isModelFactory } = await import(
      '../shared/identify'
    );

    it('should verify model factory requirements and branding', () => {
      // Create a spy factory
      const factorySpy = vi.fn(() => ({
        count: 1,
      }));

      const model = createModel(factorySpy);

      // Model should be a function
      expect(typeof model).toBe('function');

      expect(isModelInstance(model)).toBe(true);

      // Create tools for testing
      const mockSet = vi.fn();
      const mockGet = vi.fn();

      // Create a slice with the mock tools
      const sliceCreator = model();
      const slice = sliceCreator({ get: mockGet, set: mockSet });

      // Factory should be called with the tools
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          get: mockGet,
          set: mockSet,
        })
      );

      const toolsObj = (factorySpy.mock.calls[0] as any)[0];
      expect(isModelFactory(toolsObj)).toBe(true);

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
