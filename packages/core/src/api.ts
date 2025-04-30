import {
  ApiMethods,
  CreateApiResult,
  ExtractState,
  SetState,
  GetState,
  ReactiveApiBase,
  StronglyTypedAPI,
  HookSystem,
  BeforeHook,
  AfterHook,
  MethodParams,
  MethodReturnType,
  MethodDefinition,
} from './types';
import { create } from 'zustand';

/**
 * Interface for objects with getState method (like Zustand stores)
 */
interface StateContainer {
  getState: () => Record<string, unknown>;
}

/**
 * Creates a reactive API with a hooks system.
 *
 * @param dependencies - Dependencies to be used in the API factory
 * @param factory - Function that creates the API
 * @returns An object containing the API and hooks system
 */
export function createAPI<
  TDependencies extends Record<string, unknown>,
  TApi extends ApiMethods,
>(
  dependencies: TDependencies,
  factory: (
    set: SetState<ExtractState<TApi>>,
    get: GetState<ExtractState<TApi>>
  ) => TApi
): CreateApiResult<TApi> {
  // Extract state type - only non-function properties
  type ApiStateType = ExtractState<TApi>;

  // Create a reactive Zustand store for actual state only
  const apiStore = create<ApiStateType>(() => {
    // Create empty state object with correct type
    return {} as ApiStateType;
  });

  // Create a merged get function that provides access to dependencies
  const createEnhancedGet = () => {
    // Create a function that returns a merged object of all dependencies' states
    // and the current API state
    return () => {
      const mergedState = {} as Record<string, unknown>;

      // Add all dependencies' states to the merged state
      for (const [key, dependency] of Object.entries(dependencies)) {
        // Check if dependency is a Zustand store with getState method
        if (
          dependency &&
          typeof dependency === 'object' &&
          'getState' in dependency &&
          typeof (dependency as StateContainer).getState === 'function'
        ) {
          // Add this dependency's state to the merged state
          Object.assign(mergedState, (dependency as StateContainer).getState());
        } else {
          // Just add the dependency as is
          mergedState[key] = dependency;
        }
      }

      // Add the API's own state to the merged state
      Object.assign(mergedState, apiStore.getState());

      return mergedState;
    };
  };

  // Get the raw API object from the factory with enhanced get
  const rawApi = factory(
    (state) => apiStore.setState(state),
    createEnhancedGet() as GetState<ExtractState<TApi>> // Pass the enhanced get function
  );

  // Update the initial state with non-function properties
  apiStore.setState(() => {
    const stateProps = {} as ApiStateType;

    // Extract non-function properties for state
    for (const key of Object.keys(rawApi) as Array<keyof TApi>) {
      if (typeof rawApi[key] !== 'function') {
        // We need to check if this key is assignable to the state type
        // Type-safe assignment using keyof ApiStateType
        const stateKey = key as keyof ApiStateType;
        stateProps[stateKey] = rawApi[key] as ApiStateType[keyof ApiStateType];
      }
    }

    return stateProps;
  });

  // Set up hooks system with proper typing
  const hookSystem = {
    before: {} as Record<string, Array<BeforeHook<MethodParams>>>,
    after: {} as Record<
      string,
      Array<AfterHook<MethodReturnType, MethodParams>>
    >,
  };

  // Create an enhanced apiStore that follows the spec pattern
  // This merges the store with its state for a simpler interface
  const enhancedApi = {
    // Initialize empty .use property for React hooks
    use: {} as ReactiveApiBase['use'],
    // Add getState, setState, subscribe methods from the store
    getState: apiStore.getState,
    setState: apiStore.setState,
    subscribe: apiStore.subscribe,
  } as unknown as StronglyTypedAPI<TApi>;

  // Define getters for state properties
  // This allows direct access to state properties (api.count)
  const stateKeys = Object.keys(apiStore.getState()) as Array<
    keyof ApiStateType
  >;
  for (const key of stateKeys) {
    Object.defineProperty(enhancedApi, key, {
      get: () => apiStore.getState()[key],
      enumerable: true,
    });
  }

  // Attach functions directly to the API object
  for (const key of Object.keys(rawApi) as Array<keyof TApi>) {
    if (typeof rawApi[key] === 'function') {
      const originalFn = rawApi[key] as MethodDefinition;

      // Create hook arrays for this function
      hookSystem.before[key as string] = [];
      hookSystem.after[key as string] = [];

      // Attach enhanced function directly to API object
      (enhancedApi[key] as unknown) = ((...args: MethodParams) => {
        // Run before hooks
        const beforeHooks = hookSystem.before[key as string] || [];
        for (const hook of beforeHooks) {
          const result = hook(...args);
          if (result === false) return undefined; // Cancel if a hook returns false
        }

        // Run the original function
        const result = originalFn(...args);

        // Run after hooks
        const afterHooks = hookSystem.after[key as string] || [];
        for (const hook of afterHooks) {
          hook(result, ...args);
        }

        return result;
      }) as TApi[keyof TApi];
    }
  }

  // Auto-generate hook-friendly selectors for React
  for (const key of Object.keys(rawApi) as Array<keyof TApi>) {
    if (typeof rawApi[key] === 'function') {
      // For functions, return the enhanced function from the API
      (enhancedApi.use[key as string] as unknown) = () => enhancedApi[key];
    } else {
      // For state values, create a selector function
      (enhancedApi.use[key as string] as unknown) = () =>
        // Use type-safe selector to extract this property from state
        apiStore((state) => {
          // The key is known to be in the state because we built it that way
          return state[key as unknown as keyof ApiStateType];
        });
    }
  }

  // Create type-safe hooks manager
  const hooks: HookSystem = {
    before: (methodName, hook) => {
      if (!hookSystem.before[methodName]) {
        hookSystem.before[methodName] = [];
      }
      // Store the hook in the appropriate hook array
      hookSystem.before[methodName].push(hook as BeforeHook<MethodParams>);
      return enhancedApi; // For chaining
    },
    after: (methodName, hook) => {
      if (!hookSystem.after[methodName]) {
        hookSystem.after[methodName] = [];
      }
      // Store the hook in the appropriate hook array
      hookSystem.after[methodName].push(
        hook as AfterHook<MethodReturnType, MethodParams>
      );
      return enhancedApi; // For chaining
    },
  };

  // Return both the API and hooks system
  return { api: enhancedApi, hooks };
}
