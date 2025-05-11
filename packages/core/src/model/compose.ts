import type { ModelInstance } from '../shared/types';
import { createModel } from './create';
import { markAsLatticeModel } from './identify';
import { createComposedInstance } from '../shared/compose';
import { isFinalized } from '../shared/instance';
import { GetState } from '../shared/types';

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
>(baseModel: TBase, extensionModel: TExt) {
  // Cast the shared composed instance to the specific ModelInstance type
  return createComposedInstance(
    baseModel,
    extensionModel,
    createModel,
    markAsLatticeModel
  );
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
      doubleCount: () => get!().count * 2,
    }));

    // Verify the extended model contains properties from both models
    const sliceCreator = extendedModel();

    // Create a properly typed mock state for our get function
    const mockState = {
      count: 10,
      doubleCount: () => 20,
    };
    const mockGet: GetState<CounterState & StatsState> = vi.fn(() => mockState);
    const slice = sliceCreator({ get: mockGet, set: vi.fn() });

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
        log: () => `${get!().name}: ${get!().count}`,
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
    const slice = sliceCreator({ get: mockGet, set: vi.fn() });

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
      doubleCount: () => get!().count * 2,
    }));

    // Verify the model has a .create() method
    expect(extendedModel.create).toBeDefined();
    expect(typeof extendedModel.create).toBe('function');

    // Finalize the model
    const finalModel = extendedModel.create();

    // Verify the finalized model contains all expected properties
    expect(finalModel).toBeDefined();

    // Verify the finalized model is marked as finalized
    expect(isFinalized(finalModel)).toBe(true);

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
    const slice = sliceCreator({ get: mockGet, set: vi.fn() });

    // Verify all properties and functionality are preserved
    expect(slice).toHaveProperty('count');
    expect(slice).toHaveProperty('doubleCount');
    expect(slice.count).toBe(10);
    expect(slice.doubleCount()).toBe(20);
  });
}
