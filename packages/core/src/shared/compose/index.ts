import { isFinalized } from '../instance';
import type {
  RuntimeTools,
  BaseInstance,
  SliceFactory,
  ComposedState,
  Finalized,
  InstanceState,
  GetState,
  SetState,
} from '../types';

/**
 * Creates a composed instance that combines two input instances
 *
 * @param baseInstance The base instance to extend
 * @param extensionInstance The instance containing extensions
 * @param createEntityFn Function to create a new entity
 * @param markerFn Function to mark an entity
 * @returns An instance representing the composed entity
 */
export function createComposedInstance<
  TBase extends BaseInstance<any>,
  TExt extends BaseInstance<any>,
>(
  baseInstance: TBase,
  extensionInstance: TExt,
  createEntityFn: <U>(
    factory: (tools: RuntimeTools<U>) => U
  ) => BaseInstance<U>,
  markerFn: <T>(instance: T) => T
): BaseInstance<ComposedState<InstanceState<TBase>, InstanceState<TExt>>> {
  type TComposed = ComposedState<InstanceState<TBase>, InstanceState<TExt>>;

  const composedInstance =
    function composedInstance(): SliceFactory<TComposed> {
      return function composedSliceFactory(
        options: RuntimeTools<TComposed>
      ): TComposed {
        // Get slices from both instances
        const baseSlice = baseInstance()(options);
        const extensionSlice = extensionInstance()(options);

        // Combine the properties from both slices
        return { ...baseSlice, ...extensionSlice };
      };
    };

  // Add the .with() method for fluent composition
  composedInstance.with = function with_<U extends InstanceState<TBase>>(
    extensionRuntimeTools: (
      tools: RuntimeTools<ComposedState<TComposed, U>>
    ) => U
  ): BaseInstance<ComposedState<TComposed, U>> {
    return createComposedInstance(
      composedInstance,
      createEntityFn(extensionRuntimeTools),
      createEntityFn,
      markerFn
    );
  };

  // Add the .create() method for instance finalization
  composedInstance.create = function create(): Finalized<TComposed> {
    // Create a finalized instance that contains the same slice creator
    const finalizedInstance = () => composedInstance();

    // Mark as finalized
    Object.defineProperty(finalizedInstance, '__finalized', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return finalizedInstance as Finalized<TComposed>;
  };

  // Mark as a valid Lattice instance
  return markerFn(composedInstance) as BaseInstance<
    ComposedState<InstanceState<TBase>, InstanceState<TExt>>
  >;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createComposedInstance', () => {
    // Mock functions for testing purposes
    type TestCreateEntityFn = <T>(
      factory: (tools: RuntimeTools<T>) => T
    ) => BaseInstance<T>;

    // Create a simple instance factory for testing
    const createTestEntity: TestCreateEntityFn = <T>(
      factory: SliceFactory<T>
    ): BaseInstance<T> => {
      function instance() {
        return (options: RuntimeTools<T>) => factory(options);
      }

      instance.with = <U>(
        extensionRuntimeTools: (tools: RuntimeTools<any>) => U
      ): BaseInstance<ComposedState<T, U>> => {
        const extension = createTestEntity(extensionRuntimeTools);
        return createComposedInstance(
          instance,
          extension,
          createTestEntity,
          (x) => x
        );
      };

      instance.create = (): Finalized<T> => {
        const finalizedInstance = () => instance();
        Object.defineProperty(finalizedInstance, '__finalized', {
          value: true,
          enumerable: false,
          writable: false,
          configurable: false,
        });

        return finalizedInstance as Finalized<T>;
      };

      return instance as BaseInstance<T>;
    };

    it('should support fluent composition with .with() method', () => {
      // Define explicit types for our test instances
      type CounterState = {
        count: number;
      };

      type StatsState = {
        doubleCount: () => number;
      };

      // Create a base instance
      const baseInstance = createTestEntity<CounterState>(() => ({
        count: 10,
      }));

      // Assert that the instance has a .with() method
      expect(baseInstance.with).toBeDefined();

      // Create an extension to the instance using the .with() method
      const extendedInstance = baseInstance.with(({ get }) => ({
        doubleCount: () => (get ? get().count * 2 : 0),
      })) as BaseInstance<CounterState & StatsState>;

      // Verify the extended instance contains properties from both instances
      const sliceCreator = extendedInstance();

      // Create a properly typed mock state for our get function
      const mockState = {
        count: 10,
        doubleCount: () => 20,
      };
      const mockGet = vi.fn(() => mockState);
      const mockSet = vi.fn();
      const slice = sliceCreator({ get: mockGet, set: mockSet });

      expect(slice).toHaveProperty('count');
      expect(slice).toHaveProperty('doubleCount');
      expect(slice.count).toBe(10);
      expect(typeof slice.doubleCount).toBe('function');
    });

    it('should finalize an instance with .create() method', () => {
      // Define explicit types for our test instances
      type CounterState = {
        count: number;
      };

      type StatsState = {
        doubleCount: () => number;
      };

      // Create a composed instance with .with()
      const baseInstance = createTestEntity<CounterState>(() => ({
        count: 10,
      }));

      const extendedInstance = baseInstance.with(({ get }) => ({
        doubleCount: () => (get ? get().count * 2 : 0),
      })) as BaseInstance<CounterState & StatsState>;

      // Verify the instance has a .create() method
      expect(extendedInstance.create).toBeDefined();
      expect(typeof extendedInstance.create).toBe('function');

      // Finalize the instance
      const finalInstance = extendedInstance.create();

      // Verify the finalized instance contains all expected properties
      expect(finalInstance).toBeDefined();

      // Verify the finalized instance is marked as finalized
      expect(isFinalized(finalInstance)).toBe(true);

      // Verify the finalized instance is a function (slice creator)
      expect(typeof finalInstance).toBe('function');

      // Verify the finalized instance preserves the original instance's functionality
      const sliceCreator = finalInstance();

      // Create a properly typed mock state for our get function
      const mockState = {
        count: 10,
        doubleCount: () => 20,
      };
      const mockGet = vi.fn(() => mockState);
      const mockSet = vi.fn();
      const slice = sliceCreator({ get: mockGet, set: mockSet });

      // Verify all properties and functionality are preserved
      expect(slice).toHaveProperty('count');
      expect(slice).toHaveProperty('doubleCount');
      expect(slice.count).toBe(10);
      expect(typeof slice.doubleCount).toBe('function');
    });

    it('should support different factory types', () => {
      // Test with a model-like instance (get/set)
      const modelInstance = createTestEntity<{ count: number }>(
        ({ get, set: _ }) => ({
          count: get ? get().count : 10,
        })
      );

      // Test with an actions-like instance (mutate)
      const actionsInstance = createTestEntity<{ increment: () => void }>(
        ({ mutate: _ }) => ({
          increment: () => {},
        })
      );

      // Compose them together
      const composedInstance = createComposedInstance(
        modelInstance,
        actionsInstance,
        createTestEntity,
        (x) => x
      );

      // Should be able to provide any combination of factory tools
      const sliceCreator = composedInstance();
      const mockGet: GetState<any> = vi.fn(() => ({ count: 5 }));
      const mockSet: SetState<any> = vi.fn();
      const mockMutate = vi.fn();

      const slice = sliceCreator({
        get: mockGet,
        set: mockSet,
        mutate: mockMutate,
      });

      // Should have properties from both source instances
      expect(slice).toHaveProperty('count');
      expect(slice).toHaveProperty('increment');
    });
  });
}
