import { CreateLatticeOptions, LatticeWithPlugins, TypedPlugin } from './types';

/**
 * Creates a new lattice instance that bundles API, hooks, and props.
 *
 * @param namespace - The namespace for this lattice
 * @param options - Object containing the API, hooks, and props
 * @returns A lattice with the provided components and a use method for plugins
 */
export function createLattice(
  namespace: string,
  options: CreateLatticeOptions
): LatticeWithPlugins {
  const { api, hooks, props } = options;

  // Debug log the namespace creation (development only, will be stripped in production)
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`Creating lattice with namespace: ${namespace}`);
  }

  const lattice: LatticeWithPlugins = {
    api,
    hooks,
    props,
    use: function <P extends TypedPlugin<typeof lattice, any>>(plugin: P) {
      return plugin(this);
    },
  };

  return lattice;
}
