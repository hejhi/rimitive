import { mergeProps } from './mergeProps';

/**
 * Middleware for merging with a base lattice
 *
 * This middleware takes a base lattice and merges it with a provided configuration.
 * It combines the API objects, hooks, and props from both the base and the config.
 */
export function withLattice(baseLattice: any) {
  return (config: any = {}) => {
    const { api = {}, hooks = {}, props = {}, ...rest } = config;

    // Process the API objects
    const combinedApi = {
      getState: () => ({
        ...baseLattice.api.getState(),
        ...(api.getState?.() || {}),
      }),
    };

    // Process the hooks
    const combinedHooks = {
      ...baseLattice.hooks,
      ...hooks,
    };

    // Process the props - handle both legacy key-based approach and new partName-based approach
    let combinedProps;

    // Check if we're dealing with the new props system (props stores have getState and partName)
    const isNewPropsSystem = Object.values(props).some(
      (prop: any) =>
        prop &&
        typeof prop.getState === 'function' &&
        (prop.partName || prop.getState().partName)
    );

    if (isNewPropsSystem) {
      // New approach: Simply merge all props stores into a single object keyed by partName
      // mergeProps already handles this by checking for partName metadata
      const propsArray = [
        ...Object.values(baseLattice.props),
        ...Object.values(props),
      ].filter(Boolean);

      combinedProps = mergeProps(...propsArray);
    } else {
      // Legacy approach: merge by explicit keys
      combinedProps = Object.entries(props).reduce(
        (acc: any, [key, value]) => {
          if (baseLattice.props[key]) {
            acc[key] = mergeProps([baseLattice.props[key], value]);
          } else {
            acc[key] = value;
          }
          return acc;
        },
        { ...baseLattice.props }
      );
    }

    // Return the merged lattice
    return {
      api: combinedApi,
      hooks: combinedHooks,
      props: combinedProps,
      use: baseLattice.use,
      ...rest,
    };
  };
}
