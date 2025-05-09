import type {
  Factory,
  Instance,
  SliceCreator,
  GetState,
  SetState,
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
        set: SetState<TComposed>,
        get: GetState<TComposed>
      ): TComposed {
        // Get slices from both instances
        const baseSlice = baseInstance()(set, get);
        const extensionSlice = extensionInstance()(set, get);

        // Combine the properties from both slices
        return { ...baseSlice, ...extensionSlice };
      };
    };

  // Add the .with() method for fluent composition
  composedInstance.with = function with_<U>(
    extensionFactory: (tools: Factory<ComposedState<TComposed, U>>) => U
  ): Instance<ComposedState<TComposed, U>, F> {
    const newExtensionInstance = createEntityFn<U>((tools: any) => {
      return extensionFactory(tools as any);
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
        return function sliceCreator(set: SetState<T>, get: GetState<T>) {
          return factory({ get, set });
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
      const extendedInstance = baseInstance.with(
        ({ get }: { get: GetState<CounterState> }) => ({
          doubleCount: () => get().count * 2,
        })
      );

      // Verify the extended instance contains properties from both instances
      const sliceCreator = extendedInstance();

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

      const extendedInstance = baseInstance.with(
        ({ get }: { get: GetState<CounterState> }) => ({
          doubleCount: () => get().count * 2,
        })
      );

      // Verify the instance has a .create() method
      expect(extendedInstance.create).toBeDefined();
      expect(typeof extendedInstance.create).toBe('function');

      // Finalize the instance
      const finalInstance = extendedInstance.create();

      // Verify the finalized instance contains all expected properties
      expect(finalInstance).toBeDefined();

      // Verify the finalized instance is marked as finalized
      expect((finalInstance as any).__finalized).toBe(true);

      // Verify the finalized instance is a function (slice creator)
      expect(typeof finalInstance).toBe('function');

      // Verify the finalized instance preserves the original instance's functionality
      const sliceCreator = finalInstance();

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
  });
}
