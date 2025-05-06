import { createStore } from './store';
import { StoreApi } from 'zustand';

/**
 * Type representing the model initializer context provided to model factories
 */
export type ModelContext<T extends object> = {
  set: StoreApi<T>['setState'];
  get: () => T;
};

/**
 * Type representing a model initializer function
 */
export type ModelInitializer<T extends object> = (
  context: ModelContext<T>
) => T;

/**
 * Type representing a model factory function that creates instances of a model
 */
export type ModelFactory<T extends object> = () => StoreApi<T>;

/**
 * Creates a model factory with the double-function pattern.
 * This is the core building block for Lattice components.
 *
 * @returns A function that accepts a model initializer and returns a model factory
 */
export function createModel() {
  return <T extends object>(
    initializer: ModelInitializer<T>
  ): ModelFactory<T> => {
    // Return a factory function that creates a new model instance when called
    return () => {
      // Create and return the store directly
      const store = createStore<T>((set, get) => {
        // Prepare the model context with the set and get functions
        const context: ModelContext<T> = {
          set,
          get,
        };

        // Initialize the model with the provided initializer
        return initializer(context);
      });

      // Return the store directly
      return store;
    };
  };
}
