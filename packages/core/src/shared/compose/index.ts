import { isFinalized } from '../instance';
import type {
  Factory,
  Instance,
  SliceCreator,
  ComposedState,
  Finalized,
  InstanceState,
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
  TBase extends Instance<any, F>,
  TExt extends Instance<any, F>,
  F,
>(
  baseInstance: TBase,
  extensionInstance: TExt,
  createEntityFn: <U>(factory: (tools: Factory<U>) => U) => Instance<U, F>,
  markerFn: <T>(instance: T) => T
): Instance<ComposedState<InstanceState<TBase>, InstanceState<TExt>>, F> {
  type TComposed = ComposedState<InstanceState<TBase>, InstanceState<TExt>>;

  const composedInstance =
    function composedInstance(): SliceCreator<TComposed> {
      return function composedSliceCreator(
        options: Factory<TComposed>
      ): TComposed {
        // Get slices from both instances
        const baseSlice = baseInstance()(options);
        const extensionSlice = extensionInstance()(options);

        // Combine the properties from both slices
        return { ...baseSlice, ...extensionSlice };
      };
    };

  // Add the .with() method for fluent composition
  composedInstance.with = function with_<U>(
    extensionFactory: (tools: Factory<ComposedState<TComposed, U>>) => U
  ): Instance<ComposedState<TComposed, U>, F> {
    const newExtensionInstance = createEntityFn<U>((tools: any) => {
      return extensionFactory(tools);
    });

    return createComposedInstance(
      composedInstance,
      newExtensionInstance,
      createEntityFn,
      markerFn
    );
  };

  // Add the .create() method for instance finalization
  composedInstance.create = function create(): Finalized<TComposed> {
    // Create a finalized instance that contains the same slice creator
    const finalizedInstance =
      function finalizedInstance(): SliceCreator<TComposed> {
        return composedInstance();
      };

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
  return markerFn(composedInstance) as Instance<
    ComposedState<InstanceState<TBase>, InstanceState<TExt>>,
    F
  >;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createComposedInstance', () => {
    // Mock functions for testing purposes
    type TestCreateEntityFn = <T>(
      factory: (tools: Factory<T>) => T
    ) => Instance<T, unknown>;
    type TestMarkerFn = <T>(instance: T) => T;

    // Create a simple instance factory for testing
    const createTestEntity: TestCreateEntityFn = <T>(
      factory: (tools: Factory<T>) => T
    ): Instance<T, unknown> => {
      const instance = function instance(): SliceCreator<T> {
        return function sliceCreator(options: Factory<T>) {
          return factory(options);
        };
      };

      instance.with = function with_<U>(
        extensionFactory: (tools: Factory<any>) => U
      ): Instance<ComposedState<T, U>, unknown> {
        const extension = createTestEntity(extensionFactory);
        const markerFn: TestMarkerFn = <V>(x: V) => x;
        return createComposedInstance(
          instance as Instance<T, unknown>,
          extension,
          createTestEntity,
          markerFn
        );
      };

      instance.create = function create(): Finalized<T> {
        const finalizedInstance =
          function finalizedInstance(): SliceCreator<T> {
            return instance();
          };
        Object.defineProperty(finalizedInstance, '__finalized', {
          value: true,
          enumerable: false,
          configurable: false,
        });
        return finalizedInstance as Finalized<T>;
      };

      return instance as Instance<T, unknown>;
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
      })) as Instance<CounterState & StatsState, unknown>;

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
      })) as Instance<CounterState & StatsState, unknown>;

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
      const mockGet = vi.fn(() => ({ count: 5 }));
      const mockSet = vi.fn();
      const mockMutate = vi.fn();

      const slice = sliceCreator({
        get: mockGet as any,
        set: mockSet as any,
        mutate: mockMutate as any,
      });

      // Should have properties from both source instances
      expect(slice).toHaveProperty('count');
      expect(slice).toHaveProperty('increment');
    });
  });
}
