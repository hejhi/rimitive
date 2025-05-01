import { PropsConfig, PropsStore, PropsState } from './createProps';
import { StoreApi } from 'zustand';

/**
 * Type for a lattice with props
 */
interface LatticeWithProps {
  props: Record<string, PropsStore<any>>;
}

/**
 * Type for the config function in withProps
 */
type PropsConfigCreator<P> = (
  set: StoreApi<any>['setState'],
  get: StoreApi<any>['getState'],
  baseProps: PropsState<P>
) => PropsConfig<P>;

/**
 * Middleware for composing props from a base lattice
 *
 * This middleware allows props stores to access and compose with props
 * from the same part in a base lattice.
 *
 * @param baseLattice - The base lattice to compose props from
 * @returns A function that takes a props config and returns a new config with composed props
 */
export function withProps<L extends LatticeWithProps>(baseLattice: L) {
  return function <P>(config: PropsConfigCreator<P>) {
    // This middleware will be used in createProps with partName as the first parameter
    return (set: StoreApi<any>['setState'], get: StoreApi<any>['getState']) => {
      // At this point, we don't have access to the partName directly
      // It will be passed to createProps and added to the state later

      // Create a simple implementation for the initial call
      const deferredConfig = config(set, get, {
        partName: '',
        get: () => ({}),
      } as PropsState<P>);

      // Replace the get method with our wrapped version
      return {
        get: (params: P) => {
          // Now we can access the state which has been initialized with partName
          const state = get() as PropsState<P>;
          const partName = state.partName;

          // Find the base props store with the matching partName
          const basePropsStore = baseLattice.props[partName] as
            | PropsStore<P>
            | undefined;

          if (basePropsStore) {
            // Get the state of the base props store, which has the get method
            const basePropsState = basePropsStore.getState();

            // Re-run the config function with the correct baseProps
            const updatedConfig = config(set, get, basePropsState);
            return updatedConfig.get(params);
          }

          // Fall back to the original behavior if no base props found
          return deferredConfig.get(params);
        },
      };
    };
  };
}
