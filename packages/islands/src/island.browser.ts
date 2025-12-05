/**
 * Island Wrapper - Browser version
 *
 * Client-side version that skips SSR context logic entirely.
 * Creates a wrapper with metadata for the hydrator.
 */

import type { RefSpec } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy, GetContext } from './types';
import { ISLAND_META } from './types';
import { getClientContext } from './client-context.browser';

/**
 * Get the context getter for browser islands
 *
 * Returns the client context getter if set, otherwise returns
 * a getter that always returns undefined.
 */
function getContextGetter(): GetContext<unknown> {
  return getClientContext() ?? (() => undefined);
}

export function island<
  TProps,
  TSvc = Record<string, unknown>,
  TContext = unknown,
>(
  id: string,
  factory: (
    svc: TSvc,
    getContext: GetContext<TContext>
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<
  TProps,
  TSvc = Record<string, unknown>,
  TContext = unknown,
>(
  id: string,
  strategy: IslandStrategy<TProps, TSvc, TContext>,
  factory: (
    svc: TSvc,
    getContext: GetContext<TContext>
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<
  TProps,
  TSvc = Record<string, unknown>,
  TContext = unknown,
>(
  id: string,
  strategyOrFactory:
    | IslandStrategy<TProps, TSvc, TContext>
    | ((
        svc: TSvc,
        getContext: GetContext<TContext>
      ) => (props: TProps) => RefSpec<unknown>),
  maybeFactory?: (
    svc: TSvc,
    getContext: GetContext<TContext>
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  // Determine if second arg is strategy or factory
  const factory =
    maybeFactory ||
    (strategyOrFactory as (
      svc: TSvc,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>);

  const strategy = maybeFactory ? strategyOrFactory : undefined;

  // Create wrapper function
  const wrapper = (props: TProps) => {
    // Create a deferred RefSpec that delays factory execution until create(svc) is called
    const deferredSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create(svc: TSvc) {
        // Get the context getter
        const getContext = getContextGetter() as GetContext<TContext>;

        const component = factory(svc, getContext); // Pass service and context getter
        const spec = component(props); // Call component with props to get the actual RefSpec

        return spec.create(svc);
      },
    };

    return deferredSpec;
  };

  // Attach metadata for registry construction (includes factory for unwrapping)
  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy, component: factory },
    enumerable: false,
  });

  return wrapper;
}
