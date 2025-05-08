import type {
  ModelFactory,
  ModelInstance,
  SliceCreator,
  GetState,
  SetState,
  ComposedState,
  FinalizedModel,
  ModelState,
} from './types';
import { markAsLatticeModel } from './identify';
import { createModel } from './create';

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
>(
  baseModel: TBase,
  extensionModel: TExt
): ModelInstance<ComposedState<ModelState<TBase>, ModelState<TExt>>> {
  type TComposed = ComposedState<ModelState<TBase>, ModelState<TExt>>;

  const composedModelInstance =
    function composedModelInstance(): SliceCreator<TComposed> {
      return function composedSliceCreator(
        set: SetState<TComposed>,
        get: GetState<TComposed>
      ): TComposed {
        // Get slices from both models
        const baseSlice = baseModel()(set, get);
        const extensionSlice = extensionModel()(set, get);

        // Combine the properties from both slices
        return { ...baseSlice, ...extensionSlice };
      };
    };

  // Add the .with() method for fluent composition
  composedModelInstance.with = function with_<U>(
    extensionFactory: (tools: ModelFactory<ComposedState<TComposed, U>>) => U
  ): ModelInstance<ComposedState<TComposed, U>> {
    const newExtensionModel = createModel<U>((tools: any) => {
      return extensionFactory(tools as any);
    });

    return createComposedModelInstance(
      composedModelInstance,
      newExtensionModel
    );
  };

  // Add the .create() method for model finalization
  composedModelInstance.create = function create(): FinalizedModel<TComposed> {
    // Create a finalized model that contains the same slice creator
    const finalizedModel = function finalizedModel(): SliceCreator<TComposed> {
      return composedModelInstance();
    };

    // Mark as finalized
    Object.defineProperty(finalizedModel, '__finalized', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return finalizedModel as FinalizedModel<TComposed>;
  };

  // Mark as a valid Lattice model
  return markAsLatticeModel(composedModelInstance) as ModelInstance<
    ComposedState<ModelState<TBase>, ModelState<TExt>>
  >;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should support fluent composition with .with() method', () => {
    // Define explicit types for our test models
    type CounterState = {
      count: number;
    };

    type StatsState = {
      doubleCount: () => number;
    };

    // Create a base model
    const baseModel = createModel<CounterState>(() => ({
      count: 10,
    }));

    // Assert that the model has a .with() method
    expect(baseModel.with).toBeDefined();

    // Create an extension to the model using the .with() method
    const extendedModel = baseModel.with<StatsState>(({ get }) => ({
      doubleCount: () => get().count * 2,
    }));

    // Verify the extended model contains properties from both models
    const sliceCreator = extendedModel();

    // Create a properly typed mock state for our get function
    const mockState = {
      count: 10,
      doubleCount: () => 20,
    };
    const mockGet = vi.fn(() => mockState) as unknown as GetState<
      CounterState & StatsState
    >;
    const slice = sliceCreator(vi.fn(), mockGet);

    expect(slice).toHaveProperty('count');
    expect(slice).toHaveProperty('doubleCount');
    expect(slice.count).toBe(10);
    expect(slice.doubleCount()).toBe(20);
  });

  it('should support chaining multiple .with() calls', () => {
    // Define types for our models
    type BaseState = {
      name: string;
    };

    type CounterState = {
      count: number;
    };

    type LoggerState = {
      log: () => string;
    };

    type MetadataState = {
      metadata: { version: string };
    };

    // Create a base model
    const baseModel = createModel<BaseState>(() => ({
      name: 'base',
    }));

    // Chain multiple .with() calls
    const completeModel = baseModel
      .with<CounterState>(() => ({
        count: 5,
      }))
      .with<LoggerState>(({ get }) => ({
        log: () => `${get().name}: ${get().count}`,
      }))
      .with<MetadataState>(() => ({
        metadata: { version: '1.0.0' },
      }));

    // Verify the model has all properties from all extensions
    expect(completeModel).toBeDefined();

    // Initialize the model
    const sliceCreator = completeModel();

    // Set up a mock with all properties
    const mockState = {
      name: 'base',
      count: 5,
      log: () => 'base: 5',
      metadata: { version: '1.0.0' },
    };
    const mockGet = vi.fn(() => mockState) as unknown as GetState<
      BaseState & CounterState & LoggerState & MetadataState
    >;
    const slice = sliceCreator(vi.fn(), mockGet);

    // The key assertion: verify that properties from all extensions exist
    expect(slice.metadata.version).toBe('1.0.0');
  });

  it('should finalize a model with .create() method', () => {
    // Define explicit types for our test models
    type CounterState = {
      count: number;
    };

    type StatsState = {
      doubleCount: () => number;
    };

    // Create a composed model with .with()
    const baseModel = createModel<CounterState>(() => ({
      count: 10,
    }));

    const extendedModel = baseModel.with<StatsState>(({ get }) => ({
      doubleCount: () => get().count * 2,
    }));

    // Verify the model has a .create() method
    expect(extendedModel.create).toBeDefined();
    expect(typeof extendedModel.create).toBe('function');

    // Finalize the model
    const finalModel = extendedModel.create();

    // Verify the finalized model contains all expected properties
    expect(finalModel).toBeDefined();

    // Verify the finalized model is marked as finalized
    expect((finalModel as any).__finalized).toBe(true);

    // Verify the finalized model is a function (slice creator)
    expect(typeof finalModel).toBe('function');

    // Verify the finalized model preserves the original model's functionality
    const sliceCreator = finalModel();

    // Create a properly typed mock state for our get function
    const mockState = {
      count: 10,
      doubleCount: () => 20,
    };
    const mockGet = vi.fn(() => mockState) as unknown as GetState<
      CounterState & StatsState
    >;
    const slice = sliceCreator(vi.fn(), mockGet);

    // Verify all properties and functionality are preserved
    expect(slice).toHaveProperty('count');
    expect(slice).toHaveProperty('doubleCount');
    expect(slice.count).toBe(10);
    expect(slice.doubleCount()).toBe(20);
  });
}
