import type { ModelInstance, SliceCreator, GetState, SetState } from './types';
import { isLatticeModel, markAsLatticeModel } from './identify';

/**
 * Creates a composed slice by combining slices from two models
 *
 * @param baseModel The base model to extend
 * @param extensionModel The model containing extensions
 * @param set The Zustand set function
 * @param get The Zustand get function
 * @returns A combined state object with properties from both models
 */
export function createComposedSlice<T, U>(
  baseModel: ModelInstance<T>,
  extensionModel: ModelInstance<U>,
  set: SetState<T & U>,
  get: GetState<T & U>
): T & U {
  // Get slices from both models
  const baseSlice = baseModel()(set as any, get as any) as T;
  const extensionSlice = extensionModel()(set as any, get as any) as U;

  // Combine the properties from both slices
  return { ...baseSlice, ...extensionSlice } as T & U;
}

/**
 * Creates a composed model instance that combines two input models
 *
 * @param baseModel The base model to extend
 * @param extensionModel The model containing extensions
 * @returns A model instance representing the composed model
 */
export function createComposedModelInstance<T, U>(
  baseModel: ModelInstance<T>,
  extensionModel: ModelInstance<U>
): ModelInstance<T & U> {
  const composedModelInstance = function composedModelInstance(): SliceCreator<
    T & U
  > {
    return function composedSliceCreator(
      set: SetState<T & U>,
      get: GetState<T & U>
    ) {
      return createComposedSlice<T, U>(baseModel, extensionModel, set, get);
    };
  };

  // Mark as a valid Lattice model
  return markAsLatticeModel(composedModelInstance);
}

/**
 * Composes two model instances into a single model.
 * The extension model's properties will override any properties with the same name in the base model.
 *
 * @param baseModel The base model to extend
 * @param extensionModel The model containing extensions
 * @returns A new composed model instance
 * @throws Error if either model is not a valid Lattice model
 */
export function compose<T, U>(
  baseModel: ModelInstance<T>,
  extensionModel: ModelInstance<U>
): ModelInstance<T & U> {
  // Verify both models are valid Lattice models
  if (!isLatticeModel(baseModel)) {
    throw new Error('Base model is not a valid Lattice model');
  }
  if (!isLatticeModel(extensionModel)) {
    throw new Error('Extension model is not a valid Lattice model');
  }

  return createComposedModelInstance<T, U>(baseModel, extensionModel);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  // Import createModel for testing
  const { createModel } = await import('./create');

  it('should reject invalid models in compose', () => {
    const validModel = createModel(() => ({ count: 1 }));
    const invalidModel = () => ({ count: 1 });

    // Should throw when first argument is invalid
    expect(() => compose(invalidModel as any, validModel)).toThrow(
      'Base model is not a valid Lattice model'
    );

    // Should throw when second argument is invalid
    expect(() => compose(validModel, invalidModel as any)).toThrow(
      'Extension model is not a valid Lattice model'
    );
  });

  it('should mark composed models as valid lattice models', () => {
    const modelA = createModel(() => ({ a: 1 }));
    const modelB = createModel(() => ({ b: 2 }));
    const composedModel = compose(modelA, modelB);

    // Composed model should be identified as a valid lattice model
    expect(isLatticeModel(composedModel)).toBe(true);
  });

  it('should compose two models', () => {
    const baseModel = createModel(() => ({
      count: 1,
    }));

    const extensionModel = createModel(() => ({
      name: 'test',
    }));

    const composedModel = compose(baseModel, extensionModel);
    const sliceCreator = composedModel();
    const slice = sliceCreator(
      vi.fn() as SetState<any>,
      vi.fn() as GetState<any>
    ) as any;

    expect(slice).toHaveProperty('count');
    expect(slice).toHaveProperty('name');
    expect(slice.count).toBe(1);
    expect(slice.name).toBe('test');
  });

  it('should allow extension to override base model properties', () => {
    const baseModel = createModel(() => ({
      count: 1,
      name: 'baseModel',
    }));

    const extensionModel = createModel(() => ({
      count: 42, // This should override baseModel's count
    }));

    const composedModel = compose(baseModel, extensionModel);
    const sliceCreator = composedModel();
    const slice = sliceCreator(
      vi.fn() as SetState<any>,
      vi.fn() as GetState<any>
    ) as any;

    // The extension model's count should override the base model's count
    expect(slice.count).toBe(42);
    // Properties not overridden should remain from the base model
    expect(slice.name).toBe('baseModel');
  });

  it('should support derived properties across composition boundaries', () => {
    // Create a simulated state that can be updated
    let state = { count: 10 };
    const mockGet = vi.fn(() => state) as GetState<any>;

    const baseModel = createModel(() => ({
      count: 10,
    }));

    const derivedModel = createModel(({ get }: { get: GetState<any> }) => ({
      doubleCount: () => (get() as any).count * 2,
    }));

    const composedModel = compose(baseModel, derivedModel);
    const sliceCreator = composedModel();
    const slice = sliceCreator(vi.fn() as SetState<any>, mockGet) as any;

    // Test initial derived value
    expect(slice.doubleCount()).toBe(20);

    // Simulate a state change
    state = { count: 25 };

    // Test that derived property reflects the new state
    expect(slice.doubleCount()).toBe(50);

    // Verify get() was called
    expect(mockGet).toHaveBeenCalled();
  });
}
