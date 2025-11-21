import { compose, CreateContextOptions } from './compose';
import { DefinedService, ExtractDeps } from './types';

/**
 * Create an API from a set of Instantiable components and shared context
 */
export function composeFrom<
  T extends Record<string, DefinedService>,
  TDeps extends ExtractDeps<T>,
>(extensions: T, deps: TDeps, options?: CreateContextOptions) {
  const mappedComponents = Object.values(extensions).map((ext) =>
    ext.create(deps)
  ) as ReturnType<T[keyof T]['create']>[];

  if (options) return compose(options, ...mappedComponents);
  return compose(...mappedComponents);
}
