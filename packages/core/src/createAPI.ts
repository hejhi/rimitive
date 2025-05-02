import { create, StoreApi } from 'zustand';
import { combine } from 'zustand/middleware';
import {
  StateCreator,
  CreateAPIResult,
  StoreWithHooks,
  BaseState,
} from './types';
import { createHooks } from './createHooks';

/**
 * Creates an API layer with a hook system
 *
 * This function creates a Zustand store with the provided configuration,
 * adds a hooks system for intercepting method calls, and returns a clean
 * API and hooks interface.
 *
 * @param config The state creator function that defines the API
 * @returns An object containing the API store and hooks interface
 */
export function createAPI<T>(config: StateCreator<T>): CreateAPIResult<T> {
  // Create a hooks system
  const hooks = createHooks();

  // Create a base state with hooks system
  const baseState: BaseState = { _hooks: hooks };

  // Create the enhanced config with combined state
  const enhancedConfig = (setState: any, getState: any, store: any) => {
    // Get the original state from the user config
    const originalState = config(setState, getState, store);

    // Use combine middleware to create the final state creator
    return combine(baseState, (_set, get) => {
      // Process each property/method from the original state
      const processed: Record<string, unknown> = {};

      Object.entries(originalState as Record<string, unknown>).forEach(
        ([key, value]) => {
          if (
            typeof value === 'function' &&
            !key.startsWith('get') &&
            !key.startsWith('set')
          ) {
            // Wrap method with before/after hooks
            processed[key] = (...args: unknown[]) => {
              // Get hooks from current state
              const currentHooks = get()._hooks;

              // Execute before hooks with original arguments
              const modifiedArgs = currentHooks.executeBefore(key, ...args);

              // Call the original method with possibly modified arguments
              const result = value(
                modifiedArgs !== undefined ? modifiedArgs : args[0],
                ...args.slice(1)
              );

              // Execute after hooks with result and original arguments
              return currentHooks.executeAfter(key, result, ...args);
            };
          } else {
            // For non-method properties, just assign them
            processed[key] = value;
          }
        }
      );

      return processed;
    })(setState, getState, store);
  };

  // Create API store with proper type cast
  const apiStore = create(enhancedConfig) as unknown as StoreApi<
    StoreWithHooks<T>
  >;

  // Return the API store and hooks interface
  return {
    api: apiStore,
    hooks: {
      before: (method: string, callback: Function) =>
        apiStore.getState()._hooks.before(method, callback),
      after: (method: string, callback: Function) =>
        apiStore.getState()._hooks.after(method, callback),
    },
  };
}
