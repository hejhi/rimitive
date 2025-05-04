import { LatticeWithProps } from './types';

/**
 * A middleware that composes a props store with base props functionality
 *
 * @param baseLattice - The lattice containing the base props
 * @param partName - The name of the part to compose
 * @returns A function that can be used with createProps
 */
export const withProps = (baseLattice: LatticeWithProps, partName: string) => {
  // Return a function that takes a state creator function with _set, _get, and store parameters
  return <P, R>(
    storeAccessorFn: (
      _set: any,
      _get: any,
      store: { getBaseProps: (params?: P) => R }
    ) => {
      partName: string;
      get: (params?: P) => R;
    }
  ) => {
    // Return a function that createProps can use
    return () => {
      // Create an object that has getBaseProps
      const storeHelpers = {
        getBaseProps: (params?: P): R => {
          const baseStore = baseLattice.props[partName];

          // Return empty object if no base store exists
          if (!baseStore) return {} as R;

          try {
            const baseState = baseStore.getState();
            const baseGet = baseState.get;

            // Handle different function signatures
            if (baseGet.length === 0) {
              return baseGet();
            } else if (params !== undefined) {
              return baseGet(params);
            } else {
              return baseGet({});
            }
          } catch (error) {
            console.warn(`Error getting base props for ${partName}:`, error);
            return {} as R;
          }
        },
      };

      // Call the user's function with our store helpers
      const result = storeAccessorFn(null, null, storeHelpers);

      // Return the correct shape that createProps expects
      return {
        partName: result.partName,
        get: result.get,
      };
    };
  };
};
