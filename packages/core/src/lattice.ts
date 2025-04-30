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
      // Apply the plugin to get an enhanced lattice
      const enhancedLattice = plugin(this);

      // Create a record of original methods from the API
      const originalMethods: Record<string, Function> = {};

      // Keep track of already processed methods to prevent double application
      const processedMethods = new Set<string>();

      // Identify all function properties from the original API that we need to maintain
      Object.keys(this.api).forEach((key) => {
        const method = this.api[key];
        if (
          typeof method === 'function' &&
          key !== 'use' &&
          key !== 'getState' &&
          key !== 'setState' &&
          key !== 'subscribe'
        ) {
          originalMethods[key] = method;
          processedMethods.add(key);
        }
      });

      // Process the methods in the enhanced API to maintain original functionality
      Object.keys(originalMethods).forEach((key) => {
        const originalMethod = originalMethods[key];
        const enhancedMethod = enhancedLattice.api[key];

        // If the key exists in both APIs and is a function in both, combine their behaviors
        if (
          enhancedMethod &&
          originalMethod &&
          enhancedMethod !== originalMethod &&
          typeof enhancedMethod === 'function'
        ) {
          // Override with a method that invokes the original once
          enhancedLattice.api[key] = function (...args: any[]) {
            // Only call the original method directly if it's from the base lattice
            // to avoid duplicate calls when chaining plugins
            const result = originalMethod.call(this.api || this, ...args);
            return result;
          };
        } else if (!enhancedMethod && originalMethod) {
          // If the method doesn't exist in the enhanced API, add it
          enhancedLattice.api[key] = function (...args: any[]) {
            return originalMethod.call(this.api || this, ...args);
          };
        }
      });

      // Also ensure state properties are shared
      if ('getState' in this.api && typeof this.api.getState === 'function') {
        // Type assertion for the getState method
        const getState = this.api.getState as () => Record<string, unknown>;
        const originalState = getState();

        // For each non-function property in the original state
        Object.keys(originalState).forEach((key) => {
          const value = originalState[key];
          if (typeof value !== 'function' && !processedMethods.has(key)) {
            // Define a getter for the property that always returns the current value
            // from the original API's state
            Object.defineProperty(enhancedLattice.api, key, {
              get: function () {
                return getState()[key];
              },
              enumerable: true,
              configurable: true,
            });
          }
        });
      }

      // Ensure the enhanced lattice's use method maintains the chain correctly
      const originalUse = enhancedLattice.use;
      enhancedLattice.use = function <
        NextP extends TypedPlugin<typeof enhancedLattice, any>,
      >(nextPlugin: NextP) {
        return originalUse.call(this, nextPlugin);
      };

      return enhancedLattice;
    },
  };

  return lattice;
}
