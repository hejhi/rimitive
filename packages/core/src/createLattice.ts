/**
 * Lattice configuration object interface
 */
export interface LatticeConfig {
  api?: any;
  hooks?: any;
  props?: Record<string, any>;
  use?: (plugin: (lattice: any) => any) => any;
  [key: string]: any;
}

/**
 * Lattice object interface
 */
export interface Lattice {
  name: string;
  api: any;
  hooks: any;
  props: Record<string, any>;
  use: (plugin: (lattice: Lattice) => Lattice) => Lattice;
  [key: string]: any;
}

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
    api = {},
    hooks = {},
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
