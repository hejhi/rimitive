import { LatticeConfig, Lattice, StoreWithHooks, PropsStore } from './types';
import { StoreApi } from 'zustand';

/**
 * Create a lattice with the given name and configuration
 *
 * A lattice is a bundle of APIs, hooks, props with namespaces.
 * Lattices can compose other lattices through the use method.
 */
export function createLattice<T>(
  name: string,
  config: LatticeConfig<T> = {}
): Lattice<T> {
  // Extract configuration with defaults
  const {
    api,
    hooks = {
      before: () => {},
      after: () => {},
    },
    props = {},
    use = function <U>(
      this: Lattice<T>,
      plugin: (lattice: Lattice<T>) => Lattice<T & U>
    ): Lattice<T & U> {
      return plugin(this);
    },
    ...rest
  } = config;

  // Return the lattice object with proper casting to ensure type safety
  const lattice: Lattice<T> = {
    name,
    api: api as StoreApi<StoreWithHooks<T>>,
    hooks,
    props: props as Record<string, PropsStore<any, any>>,
    use,
    ...rest,
  };

  return lattice;
}
