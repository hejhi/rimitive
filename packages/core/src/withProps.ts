import { WithPropsMW, PropsFn } from './types';

/**
 * A Zustand-style middleware that composes a props store with base props functionality
 *
 * @param baseLattice - The lattice containing the base props
 * @returns A function that takes a state creator and returns an composed state creator
 */
export const withProps: WithPropsMW = (baseLattice) => {
  // Return an composed state creator function
  return function composeStateCreator<P, R>(fn: any): PropsFn<P, R> {
    return (set, get, api) => {
      // Create getBaseProps function for accessing base props
      const getBaseProps = (params?: P): R => {
        const state = get();
        const partName = state.partName;
        const baseStore = baseLattice.props[partName];

        // Return empty object if no base store exists
        if (!baseStore) return {} as R;

        try {
          const baseState = baseStore.getState();
          const baseGet = baseState.get;

          // Handle different function signatures
          if (baseGet.length === 0) {
            return (baseGet as () => R)();
          } else if (params !== undefined) {
            return (baseGet as (params: P) => R)(params);
          } else {
            return (baseGet as (params: P) => R)({} as P);
          }
        } catch (error) {
          console.warn(`Error getting base props for ${partName}:`, error);
          return {} as R;
        }
      };

      // Get user's state with composed store
      const userState = fn(set, get, { ...api, getBaseProps });
      const originalGet = userState.get;

      // Check if user is already manually handling base props
      const userGetSourceCode = originalGet.toString();
      const hasPotentialBasePropsUsage =
        userGetSourceCode.includes('getBaseProps') ||
        userGetSourceCode.includes('baseProps');

      // User is already manually handling base props integration
      if (hasPotentialBasePropsUsage) return userState;

      // Otherwise, automatically integrate with base props
      const integratedGet =
        // For parameterless get functions
        originalGet.length === 0
          ? () => {
              try {
                const baseProps = getBaseProps();
                const originalProps = (originalGet as () => R)();
                return { ...baseProps, ...originalProps };
              } catch (error) {
                return (originalGet as () => R)();
              }
            }
          : (params: P) => {
              try {
                const baseProps = getBaseProps(params);
                const originalProps = (originalGet as (params: P) => R)(params);
                return { ...baseProps, ...originalProps };
              } catch (error) {
                return (originalGet as (params: P) => R)(params);
              }
            };

      return {
        ...userState,
        get: integratedGet,
      };
    };
  };
};
