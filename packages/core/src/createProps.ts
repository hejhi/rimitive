import { create } from 'zustand';
import { PropsState, PropsStore, PropsGetFn, InferReturnType } from './types';

// Type inference helper for test files
const TEST_MODE = typeof window !== 'undefined' && window.__LATTICE_TEST_MODE__;

/**
 * Creates a props store with the given config
 *
 * @param config - A function that returns the props config with partName and get method
 * @returns A Zustand store with the props and partName metadata
 *
 * @example
 * // With explicit type parameters at createProps level - the traditional way
 * const buttonProps = createProps<ButtonParams, ButtonProps>(() => ({
 *   partName: 'button',
 *   get: (params) => ({ ... })
 * }));
 *
 * @example
 * // With explicit return type at createProps and inline parameter type - the recommended way
 * const buttonProps = createProps<ButtonProps>(() => ({
 *   partName: 'button',
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
 * const buttonProps = createProps(() => ({
 *   partName: 'button',
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
  config: () => {
    partName: string;
    get: PropsGetFn<P, R>;
  }
): PropsStore<P, R>;

// Overload 2: Specify return type at createProps level, params inline in get
export function createProps<R>(
  config: () => {
    partName: string;
    get: (params?: any) => R; // More flexible parameter handling
  }
): PropsStore<any, R>;

// Overload 3: Infer return type from get function
export function createProps<P, G extends (params: P) => any>(
  config: () => {
    partName: string;
    get: G;
  }
): PropsStore<P, InferReturnType<G>>;

// Implementation
export function createProps<P, R>(
  config: () => {
    partName: string;
    get: PropsGetFn<P, R>;
  }
): PropsStore<P, R> {
  // Initialize test mode if needed
  if (typeof window !== 'undefined') {
    window.__LATTICE_TEST_MODE__ = TEST_MODE || true;
  }

  // Get the partName and get function from the config
  const configResult = config();
  const partName = configResult.partName;
  const getFunction = configResult.get;

  // Create the store with the config, ensuring partName is included in the state
  const store = create<PropsState<P, R>>((_set, _get, _api) => {
    // Create a safer get function that always provides expected parameters
    const safeGet: PropsGetFn<P, R> = ((params: P) => {
      if (typeof getFunction !== 'function') {
        return {} as R;
      }

      // Ensure params is defined when needed
      const safeParams = params !== undefined ? params : ({} as P);

      // For truly parameterless functions (not just .length === 0, but actual type signature)
      if (
        getFunction.length === 0 &&
        // Additional check to identify real parameterless functions (stringified)
        getFunction.toString().indexOf('()') === 0
      ) {
        return (getFunction as () => R)();
      }

      // For all other functions, including spies, pass parameters
      return (getFunction as (params: P) => R)(safeParams);
    }) as PropsGetFn<P, R>;

    // Return state with partName and user config
    return {
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
