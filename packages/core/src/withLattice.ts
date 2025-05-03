import { mergeProps } from './mergeProps';
import { Lattice, LatticeConfig, PropsStore, StoreWithHooks } from './types';
import { StoreApi } from 'zustand';

/**
 * Middleware for merging with a base lattice
 *
 * This middleware takes a base lattice and merges it with a provided configuration.
 * It combines the API objects, hooks, and props from both the base and the config.
 */
export function withLattice<T>(baseLattice: Lattice<T>) {
  return <U>(config: LatticeConfig<U> = {}): LatticeConfig<T & U> => {
    const { api, hooks = {}, props = {}, ...rest } = config;

    // Process the API objects to preserve the StoreApi interface
    const combinedApi = {
      getState: () => {
        const baseState = baseLattice.api.getState();
        const configState = api?.getState?.() || {};
        return { ...baseState, ...configState } as StoreWithHooks<T & U>;
      },
      setState: (
        partial:
          | Partial<StoreWithHooks<T & U>>
          | ((state: StoreWithHooks<T & U>) => Partial<StoreWithHooks<T & U>>),
        replace?: boolean
      ) => {
        if (api?.setState) {
          // Cast to any to bypass strict typing temporarily
          // This is necessary due to complex typing in Zustand's setState
          const setStateFn = api.setState as any;
          return setStateFn(partial, replace);
        }
        // Cast to any to bypass strict typing temporarily
        const setStateFn = baseLattice.api.setState as any;
        return setStateFn(partial, replace);
      },
      subscribe: (
        listener: (
          state: StoreWithHooks<T & U>,
          prevState: StoreWithHooks<T & U>
        ) => void
      ) => {
        if (api?.subscribe) {
          return api.subscribe(listener as any);
        }
        return baseLattice.api.subscribe(listener as any);
      },
      getInitialState: () => {
        if (api?.getInitialState) {
          return api.getInitialState();
        }
        return baseLattice.api.getInitialState();
      },
    } as StoreApi<StoreWithHooks<T & U>>;

    // Process the hooks
    const combinedHooks = {
      ...baseLattice.hooks,
      ...hooks,
    };

    // Process the props - handle both legacy key-based approach and new partName-based approach
    let combinedProps: Record<string, PropsStore<any, any>>;

    // Check if we're dealing with the new props system (props stores have getState and partName)
    const propsValues = Object.values(props);
    const isNewPropsSystem = propsValues.some(
      (prop) =>
        prop &&
        typeof (prop as PropsStore<any, any>).getState === 'function' &&
        ((prop as PropsStore<any, any>).partName ||
          (prop as PropsStore<any, any>).getState().partName)
    );

    if (isNewPropsSystem) {
      // New approach: Simply merge all props stores into a single object keyed by partName
      // mergeProps already handles this by checking for partName metadata
      const propsArray = [
        ...Object.values(baseLattice.props),
        ...propsValues,
      ].filter(Boolean) as PropsStore<any, any>[];

      combinedProps = mergeProps(...propsArray);
    } else {
      // Legacy approach: merge by explicit keys
      combinedProps = Object.entries(props).reduce(
        (acc: Record<string, PropsStore<any, any>>, [key, value]) => {
          if (baseLattice.props[key]) {
            // Create a temporary merged object and extract the store for this key
            const merged = mergeProps(
              baseLattice.props[key],
              value as PropsStore<any, any>
            );
            // Find the matching partName in the merged result
            const partName = baseLattice.props[key].partName;
            if (merged[partName]) {
              acc[key] = merged[partName];
            } else {
              // Fallback to the original store if merging fails
              acc[key] = baseLattice.props[key];
            }
          } else {
            acc[key] = value as PropsStore<any, any>;
          }
          return acc;
        },
        { ...baseLattice.props }
      );
    }

    // Return the merged lattice config
    return {
      api: combinedApi,
      hooks: combinedHooks,
      props: combinedProps,
      use: baseLattice.use as any,
      ...rest,
    };
  };
}
