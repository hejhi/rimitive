import { finalizeInstance } from '../validation';
import { createComposedInstance } from '../compose';

/**
 * Creates an instance function that serves as a blueprint.
 *
 * @param factory A function that produces a state object with optional methods and derived properties
 * @param markerFn Function to mark the instance as a valid entity
 * @param entityName Name of the entity (model, state, etc.) for error messages
 * @returns An instance function that can be composed with other instances
 */
export function createInstance(factory, markerFn, entityName, createEntityFn) {
  const instance = () => (options) => factory(options);

  // Add the .with() method for fluent composition
  instance.with = (
    // Using a more flexible type signature that works with various factory types
    extensionFactory
  ) => {
    // Create a new instance directly from the extension factory
    // This simplifies the code by removing the unnecessary wrapper function
    // Compose the current instance with the extension instance
    return createComposedInstance(
      instance,
      createEntityFn(extensionFactory),
      createEntityFn,
      markerFn
    );
  };

  // Add the .create() method for instance finalization
  // Validate instance for circular references before finalizing
  instance.create = () => finalizeInstance(instance, entityName);

  // Mark this as a valid Lattice instance
  return markerFn(instance);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createInstance', () => {
    // Create test doubles for dependencies
    const testMarkerFn = (value) => value;

    const testCreateEntityFn = (factory) => {
      const instance = () => (options) => factory(options);

      // Minimal implementation to satisfy type requirements
      instance.with = () => ({});
      instance.create = () => ({});

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
      const mockGet = vi.fn();
      const mockSet = vi.fn();

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
      const mockSet = vi.fn((updater) => {
        if (typeof updater === 'function') {
          state = { ...state, ...updater(state) };
        } else {
          state = { ...state, ...updater };
        }
      });
      const mockGet = vi.fn(() => state);
      const instance = createInstance(
        ({ get, set }) => ({
          count: 1,
          increment: () => {
            set((state) => ({ count: state.count + 1 }));
            return get().count;
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
      const realMutate = (model, key) => {
        return (...args) => {
          return model[key](...args);
        };
      };

      const instance = createInstance(
        ({ mutate }) => ({
          increment: mutate(mockModel, 'increment'),
          reset: mutate(mockModel, 'reset'),
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
