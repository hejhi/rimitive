import { compose, CreateContextOptions } from './compose';
import { DefinedService, ExtractDeps } from './types';

export function composeFrom<
  T extends Record<string, DefinedService>,
  TDeps extends ExtractDeps<T>,
>(extensions: T, deps: TDeps, options?: CreateContextOptions) {
  const mappedComponents = Object.values(extensions).map((ext) =>
    ext(deps)
  ) as ReturnType<T[keyof T]>[];

  return options
    ? compose(options, ...mappedComponents)
    : compose(...mappedComponents);
}
