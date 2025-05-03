import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { StateCreator, StoreApi } from 'zustand/vanilla';
import {
  StoreWithHooks,
  HooksSystem,
  DirectAccessAPI,
  HooksInterface,
} from './types';
import { createHooks } from './createHooks';

/**
 * Creates an API layer with a hook system
 *
 * This function creates a Zustand store with the provided configuration,
 * adds a hooks system for intercepting method calls, and returns a clean
 * API and hooks interface with direct method access.
 *
 * @param config The state creator function that defines the API
 * @returns An object containing the API store and hooks interface
 */
export function createAPI<T>(config: StateCreator<T, [], [], T>) {
  // Create the composed config with combined state
  const composedConfig = (
    setState: StoreApi<T & { _hooks: HooksSystem }>['setState'],
    getState: StoreApi<T & { _hooks: HooksSystem }>['getState'],
    store: StoreApi<T & { _hooks: HooksSystem }>
  ) => {
    // Get the original state from the user config
    const originalState = config(setState, getState, store) as Record<
      string,
      unknown
    >;

    // Use combine middleware to create the final state creator
    return combine({ _hooks: createHooks<T>() }, (_set, get) => {
      // Process each property/method from the original state
      const processed: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(originalState)) {
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
            const result: Function = value(
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

      return processed;
    })(setState, getState, store);
  };

  // Create API store
  const apiStore = create(
    composedConfig as StateCreator<StoreWithHooks<T>, [], [], StoreWithHooks<T>>
  );

  // Add direct method access to the store
  const state = apiStore.getState();
  for (const key in state) {
    if (
      typeof state[key as keyof typeof state] === 'function' &&
      key !== '_hooks'
    ) {
      // Skip if the key already exists on the store
      if (!(key in apiStore)) {
        (apiStore as any)[key] = (...args: any[]) =>
          (state[key as keyof typeof state] as Function)(...args);
      }
    }
  }

  // Return the API store and hooks interface with the appropriate type
  return {
    api: apiStore as DirectAccessAPI<T>,
    hooks: {
      before: <K extends keyof T>(method: K, callback: Function) =>
        apiStore.getState()._hooks.before(method, callback),
      after: <K extends keyof T>(method: K, callback: Function) =>
        apiStore.getState()._hooks.after(method, callback),
    } as HooksInterface<T>,
  };
}
