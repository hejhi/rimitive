/**
 * Island Wrapper - Browser version
 *
 * Client-side version that skips SSR context logic entirely.
 * Creates a wrapper with metadata for the hydrator.
 */

import type { LifecycleCallback, RefSpec } from '@lattice/view/types';
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

export function island<TProps, TApi = Record<string, unknown>, TContext = unknown>(
  id: string,
  factory: (api: TApi, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps, TApi = Record<string, unknown>, TContext = unknown>(
  id: string,
  strategy: IslandStrategy<TProps, TApi, TContext>,
  factory: (api: TApi, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps, TApi = Record<string, unknown>, TContext = unknown>(
  id: string,
  strategyOrFactory:
    | IslandStrategy<TProps, TApi, TContext>
    | ((api: TApi, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>),
  maybeFactory?: (api: TApi, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  // Determine if second arg is strategy or factory
  const factory =
    maybeFactory ||
    (strategyOrFactory as (api: TApi, getContext: GetContext<TContext>) => (props: TProps) => RefSpec<unknown>);

  const strategy = maybeFactory ? strategyOrFactory : undefined;

  // Create wrapper function
  const wrapper = (props: TProps) => {
    const lifecycleCallbacks: LifecycleCallback<unknown>[] = [];

    // Create a deferred RefSpec that delays factory execution until create(api) is called
    const deferredSpec = Object.assign(
      (...callbacks: LifecycleCallback<unknown>[]) => {
        // Collect lifecycle callbacks
        lifecycleCallbacks.push(...callbacks);
        return deferredSpec;
      },
      {
        status: STATUS_REF_SPEC,
        create(api: TApi) {
          // Get the context getter
          const getContext = getContextGetter() as GetContext<TContext>;

          const component = factory(api, getContext); // Pass API and context getter
          const spec = component(props); // Call component with props to get the actual RefSpec

          // Apply collected lifecycle callbacks to the spec
          if (lifecycleCallbacks.length > 0) spec(...lifecycleCallbacks);

          return spec.create(api);
        },
      } as const
    );

    return deferredSpec;
  };

  // Attach metadata for registry construction (includes factory for unwrapping)
  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy, component: factory },
    enumerable: false,
  });

  return wrapper;
}
