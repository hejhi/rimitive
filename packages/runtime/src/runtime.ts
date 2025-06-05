import type { RuntimeFactory } from './types.js';

/**
 * Creates a Lattice runtime that provides a createAPI function to adapters.
 *
 * The runtime's role is minimal - it just provides a way for adapters to
 * create their API objects. In the future, this could be enhanced to apply
 * transformations, but for now it's a simple pass-through.
 *
 * @param adapterFactory - Function that uses createAPI to build an adapter result
 * @returns The result of calling the adapter factory
 */
export function createRuntime<Result>(
  adapterFactory: RuntimeFactory<Result>
): Result {
  // For now, createAPI is a simple pass-through
  // In the future, this could apply enhancements
  //
  // Reserve the right in the future to pass forward an API
  // const createAPI = <Model>(
  //   implementations: AdapterAPI<Model>
  // ): AdapterAPI<Model> => {
  //   return implementations;
  // };

  return adapterFactory();
}
