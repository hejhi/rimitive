import { LatticeConfig, Lattice, LatticeAPI } from './types';

/**
 * Create a lattice with the given name and configuration
 *
 * A lattice is a bundle of APIs, hooks, props with namespaces.
 * Lattices can compose other lattices through the use method.
 */
export function createLattice(
  name: string,
  config: LatticeConfig = {}
): Lattice {
  // Extract configuration with defaults
  const {
    api = {
      getState: () => ({}),
      setState: () => {},
    } as LatticeAPI,
    hooks = {
      before: () => {},
      after: () => {},
    },
    props = {},
    use = function (
      this: Lattice,
      plugin: (lattice: Lattice) => Lattice
    ): Lattice {
      return plugin(this);
    },
    ...rest
  } = config;

  // Return the lattice object
  return {
    name,
    api,
    hooks,
    props,
    use,
    ...rest,
  };
}
