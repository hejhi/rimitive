import { compose, CreateContextOptions } from './compose';
import { DefinedService, ExtractDeps, Svc } from './types';

/**
 * Create a service from a set of Instantiable components and shared context
 *
 * The return type preserves the key names from the extensions object:
 * ```ts
 * const svc = composeFrom({ signal: Signal(), computed: Computed() }, deps);
 * // svc.signal, svc.computed are properly typed
 * ```
 */
export function composeFrom<
  T extends Record<string, DefinedService>,
  TDeps extends ExtractDeps<T>,
>(extensions: T, deps: TDeps, options?: CreateContextOptions): Svc<T> {
  const mappedComponents = Object.values(extensions).map((ext) =>
    ext.create(deps)
  );

  if (options) return compose(options, ...mappedComponents) as Svc<T>;
  return compose(...mappedComponents) as Svc<T>;
}
