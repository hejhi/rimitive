import { MODEL_FACTORY_BRAND } from '../shared/types';
import { createInstance } from '../shared/create';
import { brandWithSymbol } from '../shared/identify';
import { markAsLatticeModel } from './identify';

/**
 * Creates a model instance function that serves as a blueprint for a Zustand store slice.
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @returns A model instance function that can be composed with other models
 */
export function createModelInstance(factory) {
  function createModelSlice(options) {
    // Ensure the required properties exist
    if (!options.get || !options.set) {
      throw new Error('Model factory requires get and set functions');
    }

    // Call the factory with properly typed tools
    return factory(
      brandWithSymbol(
        {
          get: options.get,
          set: options.set,
        },
        MODEL_FACTORY_BRAND
      )
    );
  }

  // The createInstance returns a BaseInstance, but we need to add the model-specific branding
  const instance = createInstance(
    createModelSlice,
    markAsLatticeModel,
    'model',
    createModel
  );

  // Apply model-specific branding to make it a ModelInstance
  return markAsLatticeModel(instance);
}

/**
 * Creates a factory function for a Zustand slice.
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
 * const extendedModel = counterModel.with(({ get, set }) => ({
 *   triple: () => set(state => ({ count: state.count * 3 })),
 *   isPositive: () => get().count > 0
 * }));
 *
 * // Finalize for use
 * const finalModel = extendedModel.create();
 * ```
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @returns A model instance function that can be used directly with Zustand or in composition
 */
export function createModel(factory) {
  return createModelInstance(factory);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should verify model factory requirements and branding', async () => {
    // Create a spy factory
    const factorySpy = vi.fn(() => ({
      count: 1,
    }));

    const model = createModel(factorySpy);

    // Model should be a function
    expect(typeof model).toBe('function');

    // Should have lattice model branding
    const { isModelInstance } = await import('../shared/identify');
    expect(isModelInstance(model)).toBe(true);

    // Should have the expected API (.with and .create methods)
    expect(typeof model.with).toBe('function');
    expect(typeof model.create).toBe('function');

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

    // The tools should be branded with the proper symbol
    const { isModelFactory } = await import('../shared/identify');
    const toolsObj = factorySpy.mock.calls[0]?.[0];
    expect(isModelFactory(toolsObj)).toBe(true);

    // Verify slice contains the expected value
    expect(slice).toEqual({ count: 1 });
  });

  it('should throw an error when required tools are missing', () => {
    const model = createModel(() => ({ count: 1 }));
    const sliceCreator = model();

    // Should throw when get or set are missing
    expect(() => sliceCreator({})).toThrow(
      'Model factory requires get and set functions'
    );
    expect(() => sliceCreator({ get: undefined, set: vi.fn() })).toThrow(
      'Model factory requires get and set functions'
    );
    expect(() => sliceCreator({ get: vi.fn(), set: undefined })).toThrow(
      'Model factory requires get and set functions'
    );
  });
}
