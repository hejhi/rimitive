import {
  CreateProps,
  PropsParams,
  MergedAPIs,
  FlattenedAPIs,
  Props,
  PropsFactory,
  PropsStore,
  MergePropsHelper,
} from './types';
import { create } from 'zustand';

/**
 * Creates a props function that returns ready-to-spread UI attributes.
 *
 * @param namespace - Namespace for the props (e.g. 'button', 'treeItem')
 * @param dependencies - Reactive APIs or store getters to depend on
 * @param factory - Factory function that creates props
 * @returns A Zustand store that returns props when called with parameters
 */
export const createProps: CreateProps = (namespace, dependencies, factory) => {
  // TODO: The namespace parameter is currently minimally used but will be
  // important when implementing the lattice composition system in Phase 3.
  // At that point, props will be organized by namespace in the lattice's props object:
  // props: { button: buttonProps, list: listProps, listItem: listItemProps }

  // Create a function to merge all states from dependencies
  const createMergedGetter = () => {
    return () => {
      // Create merged state object
      const mergedState: Record<string, unknown> = {};

      // Add all dependencies' states to the merged state
      for (const [key, dependency] of Object.entries(dependencies)) {
        if (
          dependency &&
          typeof dependency === 'object' &&
          'getState' in dependency &&
          typeof dependency.getState === 'function'
        ) {
          // If it's a Zustand store or ReactiveApi, add its state
          Object.assign(mergedState, dependency.getState());
        } else if (typeof dependency === 'function') {
          // If it's a plain getter function
          Object.assign(mergedState, dependency());
        } else {
          // Just add the dependency as is
          mergedState[key] = dependency;
        }
      }

      return mergedState as FlattenedAPIs<MergedAPIs<typeof dependencies>>;
    };
  };

  // Create a Zustand store that returns a props factory function
  const propsStore = create<PropsFactory>(() => {
    // Return a function that when called with params, returns props
    return (params: PropsParams = {}) => {
      // Call the factory with the merged state getter and params
      const result = factory(createMergedGetter(), params) as Props;

      // We could use namespace here for debugging or devtools in a real implementation
      if (process.env.NODE_ENV === 'development') {
        // This is just to make sure namespace is used to satisfy TypeScript
        // This code path won't be executed in production builds
        console.debug(`Props for ${namespace} created`);
      }

      return result;
    };
  });

  return propsStore;
};

/**
 * Merges multiple props stores into a single props store.
 * Later props in the array take precedence over earlier props when there are conflicts.
 *
 * @param propsList - Array of props stores to merge
 * @returns A new props store that merges all input props
 */
export const mergeProps: MergePropsHelper = (
  propsList: PropsStore[]
): PropsStore => {
  // Create a new props store that composes the provided props stores
  return create<PropsFactory>(() => {
    // Return a function that when called with params, returns merged props
    return (params: PropsParams = {}) => {
      // Create a merged props object
      const mergedProps: Props = {};

      // Call each props factory with the parameters and merge the results
      for (const propsStore of propsList) {
        // Get the props from this store with the given parameters
        const props = propsStore.getState()(params);

        // Merge into the result object, with later props overriding earlier ones
        Object.assign(mergedProps, props);
      }

      return mergedProps;
    };
  });
};
