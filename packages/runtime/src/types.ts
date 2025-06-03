import type { AdapterAPI } from '@lattice/core';

/**
 * Function that creates an adapter result using the runtime API creation.
 */
export type RuntimeFactory<Result> = (
  createAPI: <Model>(impl: AdapterAPI<Model>) => AdapterAPI<Model>
) => Result;