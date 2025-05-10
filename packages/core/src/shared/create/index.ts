import type {
  RuntimeTools,
  Instance,
  SliceCreator,
  Finalized,
  GetState,
  SetState,
} from '../types';
import { finalizeInstance } from '../validation';
import { createComposedInstance } from '../compose';

/**
 * Creates a slice creator function based on the provided factory
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param options Object containing tools for the factory (get, set, mutate, derive, etc.)
 * @returns A state object with properties, methods, and derived values
 */
export function createSliceCreator<T>(
  factory: (tools: RuntimeTools<T>) => T,
  options: RuntimeTools<T>
): T {
  // Ensure options object is well-formed before passing to factory
  // This avoids issues when testing different factories with different required tools
  const safeOptions = {
    get: options.get,
    set: options.set,
    mutate: options.mutate,
    derive: options.derive,
    dispatch: options.dispatch,
  };

  return factory(safeOptions);
}

/**
 * Creates an instance function that serves as a blueprint.
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param markerFn Function to mark the instance as a valid entity
 * @param entityName Name of the entity (model, state, etc.) for error messages
 * @returns An instance function that can be composed with other instances
 */
export function createInstance<T, F>(
  factory: (tools: RuntimeTools<T>) => T,
  markerFn: <V>(instance: V) => V,
  entityName: string,
  createEntityFn: <U>(factory: (tools: RuntimeTools<U>) => U) => Instance<U, F>
): Instance<T, F> {
  const instance = function instance(): SliceCreator<T> {
    return function sliceCreator(options: RuntimeTools<T>) {
      return createSliceCreator<T>(factory, options);
    };
  };

  // Add the .with() method for fluent composition
  instance.with = function with_<U>(
    extensionFactory: (tools: RuntimeTools<any>) => U
  ): Instance<any, F> {
    // Create a new instance from the extension factory
    const extensionInstance = createEntityFn<U>((tools) => {
      // We need to explicitly annotate tools with any here because of TypeScript's limitations
      // with modeling the cross-instance property access
      return extensionFactory(tools);
    });

    // Compose the current instance with the extension instance
    return createComposedInstance(
      instance,
      extensionInstance,
      createEntityFn,
      markerFn
    );
  };

  // Add the .create() method for instance finalization
  instance.create = function create(): Finalized<T> {
    // Validate instance for circular references before finalizing
    return finalizeInstance(instance, entityName);
  };

  // Mark this as a valid Lattice instance
  return markerFn(instance);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createSliceCreator', () => {
    it('should support flexible factory options', () => {
      // Test with get/set tools (for models)
      const modelFactory = vi.fn(({ get, set }) => ({
        count: 1,
        increment: () => set((state: any) => ({ count: state.count + 1 })),
        getCount: () => get().count,
      }));

      const mockGet = vi.fn(() => ({ count: 1 }));
      const mockSet = vi.fn();

      const modelSlice = createSliceCreator(modelFactory, {
        get: mockGet,
        set: mockSet,
      });
      expect(modelFactory).toHaveBeenCalledWith({ get: mockGet, set: mockSet });
      expect(modelSlice).toHaveProperty('count');
      expect(modelSlice).toHaveProperty('increment');

      // Test with mutate tool (for actions)
      const mockMutate = vi.fn();
      const actionsFactory = vi.fn(({ mutate }) => ({
        increment: mutate({} as any, 'increment'),
        reset: mutate({} as any, 'reset'),
      }));

      const actionsSlice = createSliceCreator(actionsFactory, {
        mutate: mockMutate,
      });
      expect(actionsFactory).toHaveBeenCalledWith({ mutate: mockMutate });
      expect(actionsSlice).toHaveProperty('increment');
      expect(actionsSlice).toHaveProperty('reset');
    });
  });

  describe('createInstance', () => {
    // Create test doubles for dependencies
    const testMarkerFn = <T>(value: T): T => value;

    const testCreateEntityFn = <T>(
      factory: (tools: RuntimeTools<T>) => T
    ): Instance<T, unknown> => {
      const instance = function instance(): SliceCreator<T> {
        return function sliceCreator(options: RuntimeTools<T>) {
          return createSliceCreator(factory, options);
        };
      };

      // Minimal implementation to satisfy type requirements
      instance.with = () => ({}) as any;
      instance.create = () => ({}) as any;

      return instance;
    };

    it('should create a basic instance with primitive values', () => {
      // Create a spy factory to check it receives the get parameter
      const factorySpy = vi.fn(() => ({
        count: 1,
      }));

      const instance = createInstance(
        factorySpy,
        testMarkerFn,
        'test',
        testCreateEntityFn
      );

      // Instance should be a function
      expect(typeof instance).toBe('function');

      // The slice creator should be a function
      const sliceCreator = instance();
      const mockGet: GetState<any> = vi.fn();
      const mockSet: SetState<any> = vi.fn();

      // Call the slice creator
      const slice = sliceCreator({ get: mockGet, set: mockSet });

      // Check that the factory is called with the correct parameters
      expect(factorySpy).toHaveBeenCalledWith({ get: mockGet, set: mockSet });

      // Also verify the slice contains the expected primitive value
      expect(slice).toEqual({ count: 1 });
    });

    it('should support methods in state', () => {
      // Create a simulated state that tracks changes
      let state = { count: 1 };
      const mockSet: SetState<any> = vi.fn(
        (updater: ((state: any) => any) | any) => {
          if (typeof updater === 'function') {
            state = { ...state, ...updater(state) };
          } else {
            state = { ...state, ...updater };
          }
        }
      );
      const mockGet: GetState<any> = vi.fn(() => state);

      // Define a type for our state
      type CounterState = {
        count: number;
        increment: () => number;
      };

      const instance = createInstance<CounterState, unknown>(
        ({ get, set }) => ({
          count: 1,
          increment: () => {
            set!((state) => ({ count: state.count + 1 }));
            return get!().count;
          },
        }),
        testMarkerFn,
        'test',
        testCreateEntityFn
      );

      const sliceCreator = instance();
      const slice = sliceCreator({
        get: mockGet,
        set: mockSet,
      });

      // Call the method and capture its return value
      const result = slice.increment();

      // Verify the set function was called
      expect(mockSet).toHaveBeenCalled();

      // Verify the state was actually updated
      expect(state.count).toBe(2);

      // Verify the method returned the updated value
      expect(result).toBe(2);
    });

    it('should support actions with mutate', () => {
      // Create mock models with the methods we need
      const mockModel = {
        increment: vi.fn(),
        reset: vi.fn(),
      };

      // Define a real mutate function
      const realMutate = <M, K extends keyof M>(model: M, key: K) => {
        return ((...args: any[]) => {
          return (model[key] as any)(...args);
        }) as any;
      };

      // Define a type for our actions
      type CounterActions = {
        increment: () => void;
        reset: () => void;
      };

      const instance = createInstance<CounterActions, unknown>(
        ({ mutate }) => ({
          increment: mutate!(mockModel, 'increment'),
          reset: mutate!(mockModel, 'reset'),
        }),
        testMarkerFn,
        'test',
        testCreateEntityFn
      );

      const sliceCreator = instance();
      const actions = sliceCreator({ mutate: realMutate });

      // Verify actions contains the expected methods
      expect(actions).toHaveProperty('increment');
      expect(actions).toHaveProperty('reset');
      expect(typeof actions.increment).toBe('function');
      expect(typeof actions.reset).toBe('function');

      // Call the actions
      actions.increment();
      actions.reset();

      // Verify the model methods were called
      expect(mockModel.increment).toHaveBeenCalled();
      expect(mockModel.reset).toHaveBeenCalled();
    });
  });
}
