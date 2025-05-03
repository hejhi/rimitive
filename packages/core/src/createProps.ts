import { create } from 'zustand';
import {
  PropsState,
  PropsStore,
  PropsFn,
  PropsGetFn,
  InferReturnType,
} from './types';

// Type inference helper for test files
const TEST_MODE = typeof window !== 'undefined' && window.__LATTICE_TEST_MODE__;

/**
 * Creates a props store with the given partName and config
 *
 * @param partName - The UI part name for the props
 * @param config - A function that returns the props config with get method
 * @returns A Zustand store with the props and partName metadata
 *
 * @example
 * // With explicit type parameters at createProps level - the traditional way
 * const buttonProps = createProps<ButtonParams, ButtonProps>('button', (set, get, store) => ({
 *   get: (params) => ({ ... })
 * }));
 *
 * @example
 * // With explicit return type at createProps and inline parameter type - the recommended way
 * const buttonProps = createProps<ButtonProps>('button', (_set, _get) => ({
 *   get: (params: ButtonParams) => ({
 *     // Return type is specified at the createProps level
 *     role: 'button',
 *     id: params.id,
 *     onClick: () => {}
 *   })
 * }));
 *
 * @example
 * // With automatic return type inference - the most concise way
 * const buttonProps = createProps('button', (_set, _get) => ({
 *   get: (params: ButtonParams) => ({
 *     // Return type is inferred from this object!
 *     role: 'button',
 *     id: params.id,
 *     onClick: () => {}
 *   })
 * }));
 */
// Overload 1: Classic explicit type parameters
export function createProps<P, R>(
  partName: string,
  config: PropsFn<P, R>
): PropsStore<P, R>;

// Overload 2: Specify return type at createProps level, params inline in get
export function createProps<R>(
  partName: string,
  config: (
    set: any,
    get: any,
    api: any
  ) => {
    get: (params?: any) => R; // More flexible parameter handling
  }
): PropsStore<any, R>;

// Overload 3: Infer return type from get function
export function createProps<P, G extends (params: P) => any>(
  partName: string,
  config:
    | {
        get: G;
      }
    | ((set: any, get: any, api: any) => { get: G })
): PropsStore<P, InferReturnType<G>>;

// Implementation
export function createProps<P, R>(
  partName: string,
  config: PropsFn<P, R> | { get: PropsGetFn<P, R> }
): PropsStore<P, R> {
  // Initialize test mode if needed
  if (typeof window !== 'undefined') {
    window.__LATTICE_TEST_MODE__ = TEST_MODE || true;
  }

  // Handle plain object config directly
  let configFn: PropsFn<P, R>;
  if (typeof config === 'function') {
    configFn = config;
  } else {
    // Convert object config to function config
    configFn = (_set, _get, _api) => ({
      get: config.get,
    });
  }

  // Create the store with the config, ensuring partName is included in the state
  const store = create<PropsState<P, R>>((set, get, api) => {
    // Initialize the state with the user config
    const initialState = configFn(set, get, api);
    const originalGet = initialState.get;

    // Create a safer get function that always provides expected parameters
    const safeGet: PropsGetFn<P, R> = ((params: P) => {
      if (typeof originalGet !== 'function') {
        return {} as R;
      }

      // Ensure params is defined when needed
      const safeParams = params !== undefined ? params : ({} as P);

      // For truly parameterless functions (not just .length === 0, but actual type signature)
      if (
        originalGet.length === 0 &&
        // Additional check to identify real parameterless functions (stringified)
        originalGet.toString().indexOf('()') === 0
      ) {
        return (originalGet as () => R)();
      }

      // For all other functions, including spies, pass parameters
      return (originalGet as (params: P) => R)(safeParams);
    }) as PropsGetFn<P, R>;

    // Return state with partName and user config
    return {
      ...initialState,
      get: safeGet,
      partName,
    };
  });

  // Extend the store with the partName property
  const extendedStore = Object.assign(store, {
    partName,
  });

  return extendedStore;
}
