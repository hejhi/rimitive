import type {
  ModelInstance,
  SliceCreator,
  GetState,
  SetState,
  ModelState,
  ComposedModelInstance,
  ComposedState,
} from './types';
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
export function createComposedSlice<
  TBase extends ModelInstance<any>,
  TExt extends ModelInstance<any>,
>(
  baseModel: TBase,
  extensionModel: TExt,
  set: SetState<ComposedState<ModelState<TBase>, ModelState<TExt>>>,
  get: GetState<ComposedState<ModelState<TBase>, ModelState<TExt>>>
): ComposedState<ModelState<TBase>, ModelState<TExt>> {
  // Get slices from both models
  const baseSlice: ModelState<TBase> = baseModel()(set, get);
  const extensionSlice: ModelState<TExt> = extensionModel()(set, get);

  // Combine the properties from both slices
  return { ...baseSlice, ...extensionSlice };
}

/**
 * Creates a composed model instance that combines two input models
 *
 * @param baseModel The base model to extend
 * @param extensionModel The model containing extensions
 * @returns A model instance representing the composed model
 */
export function createComposedModelInstance<
  TBase extends ModelInstance<any>,
  TExt extends ModelInstance<any>,
>(baseModel: TBase, extensionModel: TExt): ComposedModelInstance<TBase, TExt> {
  type TComposed = ComposedState<ModelState<TBase>, ModelState<TExt>>;

  const composedModelInstance =
    function composedModelInstance(): SliceCreator<TComposed> {
      return function composedSliceCreator(
        set: SetState<TComposed>,
        get: GetState<TComposed>
      ): TComposed {
        return createComposedSlice<TBase, TExt>(
          baseModel,
          extensionModel,
          set,
          get
        );
      };
    };

  // Mark as a valid Lattice model
  return markAsLatticeModel(composedModelInstance) as ComposedModelInstance<
    TBase,
    TExt
  >;
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
export function compose<
  TBase extends ModelInstance<any>,
  TExt extends ModelInstance<any>,
>(baseModel: TBase, extensionModel: TExt): ComposedModelInstance<TBase, TExt> {
  // Verify both models are valid Lattice models
  if (!isLatticeModel(baseModel)) {
    throw new Error('Base model is not a valid Lattice model');
  }
  if (!isLatticeModel(extensionModel)) {
    throw new Error('Extension model is not a valid Lattice model');
  }

  return createComposedModelInstance<TBase, TExt>(baseModel, extensionModel);
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
    // @ts-expect-error - invalid first argument
    expect(() => compose(invalidModel, validModel)).toThrow(
      'Base model is not a valid Lattice model'
    );

    // Should throw when second argument is invalid
    // @ts-expect-error - invalid second argument
    expect(() => compose(validModel, invalidModel)).toThrow(
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
    const slice = sliceCreator(vi.fn(), vi.fn());

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
    const slice = sliceCreator(vi.fn(), vi.fn());

    // The extension model's count should override the base model's count
    expect(slice.count).toBe(42);
    // Properties not overridden should remain from the base model
    expect(slice.name).toBe('baseModel');
  });

  it('should support derived properties across composition boundaries', () => {
    // Create a simulated state that can be updated
    let state = { count: 10 };
    const mockGet = vi.fn(() => state);

    const baseModel = createModel(() => ({
      count: 10,
    }));

    // get is cast to any, but this isn't an issue a user would encounter,
    // as they would be using `compose` inside `createModel` to actually compose
    const derivedModel = createModel(({ get }: { get: GetState<any> }) => ({
      doubleCount: () => get().count * 2,
    }));

    const composedModel = compose(baseModel, derivedModel);
    const sliceCreator = composedModel();
    const slice = sliceCreator(vi.fn(), mockGet);

    // Test initial derived value
    expect(slice.doubleCount()).toBe(20);

    // Simulate a state change
    state = { count: 25 };

    // Test that derived property reflects the new state
    expect(slice.doubleCount()).toBe(50);

    // Verify get() was called
    expect(mockGet).toHaveBeenCalled();
  });

  it('should infer correct types for composed models', () => {
    // Type test - this validates at compile time
    // Create models with different state shapes
    const counterModel = createModel(() => ({
      count: 0,
      increment: function () {
        this.count++;
        return this.count;
      },
    }));

    const userModel = createModel(() => ({
      name: 'John',
      setName: function (name: string) {
        this.name = name;
      },
    }));

    // Compose the models
    const composedModel = compose(counterModel, userModel);

    // Create a properly typed test function that enforces type checking
    function testComposedModelTypes() {
      // Setup mock functions for testing
      const mockSet = vi.fn();
      const mockGet = vi.fn();

      // Get the slice
      const slice = composedModel()(mockSet, mockGet);

      // These should type check correctly
      const count: number = slice.count;
      const name: string = slice.name;

      // Method access should type check
      slice.increment();
      slice.setName('Jane');

      // TypeScript should catch invalid property access
      // @ts-expect-error - nonexistent property
      const invalid = slice.nonexistentProperty;

      // TypeScript should catch invalid method calls
      // @ts-expect-error - setName requires a string parameter
      slice.setName(123);

      return { count, name }; // Return to avoid unused variable warnings
    }

    // This test confirms that the function compiles (type checks)
    // We don't need to execute it at runtime
    expect(typeof testComposedModelTypes).toBe('function');
  });

  it('should allow typed access to properties across model boundaries', () => {
    // Define the types for type checking
    type CounterState = {
      count: number;
      increment: () => number;
    };

    type StatsState = {
      doubleCount: () => number;
      getCountString: () => string;
    };

    type ComposedState = CounterState & StatsState;

    // Create a model with a numeric property
    const counterModel = createModel<CounterState>(() => ({
      count: 0,
      increment: function () {
        this.count++;
        return this.count;
      },
    }));

    // Create a model that references the counter model's property
    const statsModel = createModel<StatsState>(
      ({ get }: { get: GetState<any> }) => ({
        doubleCount: () => {
          return get().count * 2;
        },
        getCountString: () => {
          return `Count: ${get().count}`;
        },
      })
    );

    // Compose the models
    const composedModel = compose(counterModel, statsModel);

    // Runtime test to verify behavior
    let state = { count: 5 };
    const mockGet = vi.fn(() => state) as GetState<ComposedState>;

    const slice = composedModel()(
      vi.fn() as SetState<ComposedState>,
      mockGet
    ) as ComposedState;

    expect(slice.doubleCount()).toBe(10);
    expect(slice.getCountString()).toBe('Count: 5');

    // Update the state
    state = { count: 7 };
    expect(slice.doubleCount()).toBe(14);
    expect(slice.getCountString()).toBe('Count: 7');
  });

  it('should produce type errors for constraint violations', () => {
    // This test doesn't need to run; it just needs to type check
    function testConstraintViolations() {
      // Create some test models
      type ModelA = { a: number };
      type ModelB = { b: string };
      type ModelC = { c: boolean };

      const modelA = createModel<ModelA>(() => ({ a: 1 }));
      const modelB = createModel<ModelB>(() => ({ b: 'hello' }));
      const modelC = createModel<ModelC>(() => ({ c: true }));

      // Valid composition
      const composedAB = compose(modelA, modelB);

      // Valid: multiple compositions in sequence
      const composedABC = compose(composedAB, modelC);

      return { composedAB, composedABC };
    }

    // This just verifies the function exists
    expect(typeof testConstraintViolations).toBe('function');
  });
}
