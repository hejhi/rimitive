/**
 * Island Wrapper - Server version
 *
 * Marks components as islands - interactive regions that ship JavaScript to the client.
 * Static content remains as HTML without hydration overhead.
 */

import type { LifecycleCallback, RefSpec } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy, GetContext } from './types';
import { ISLAND_META } from './types';
import { getActiveSSRContext } from './ssr-context';
import { getClientContext } from './client-context';

/**
 * Get the context getter from available sources
 *
 * On server: uses SSR context's getContext if set
 * On client: uses client context getter if set
 * Otherwise: returns a getter that returns undefined
 */
function getContextGetter(): GetContext<unknown> {
  // Try SSR context first (server-side)
  const ssrContext = getActiveSSRContext();
  if (ssrContext?.getContext) {
    return ssrContext.getContext;
  }

  // Try client context (browser)
  const clientGetter = getClientContext();
  if (clientGetter) {
    return clientGetter;
  }

  // Fallback: return a getter that returns undefined
  return () => undefined;
}

/**
 * Mark a component as an island
 *
 * Islands are interactive components that ship JavaScript to the client.
 * During SSR, islands register themselves for hydration.
 * On the client, islands hydrate from server-rendered HTML.
 *
 * Island components receive two arguments:
 * 1. api - The user-defined service API (el, signal, computed, etc.)
 * 2. getContext - Getter function that returns user-defined context (or undefined)
 */
export function island<TProps, TApi = Record<string, unknown>, TContext = unknown>(
  id: string,
  factory: (
    api: TApi,
    getContext: GetContext<TContext>
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

/**
 * Mark a component as an island with custom hydration strategy
 */
export function island<TProps, TApi = Record<string, unknown>, TContext = unknown>(
  id: string,
  strategy: IslandStrategy<TProps, TApi, TContext>,
  factory: (
    api: TApi,
    getContext: GetContext<TContext>
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps, TApi = Record<string, unknown>, TContext = unknown>(
  id: string,
  strategyOrFactory:
    | IslandStrategy<TProps, TApi, TContext>
    | ((
        api: TApi,
        getContext: GetContext<TContext>
      ) => (props: TProps) => RefSpec<unknown>),
  maybeFactory?: (
    api: TApi,
    getContext: GetContext<TContext>
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  // Determine if second arg is strategy or factory
  const factory =
    maybeFactory ||
    (strategyOrFactory as (
      api: TApi,
      getContext: GetContext<TContext>
    ) => (props: TProps) => RefSpec<unknown>);

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

          // Create the nodeRef
          const nodeRef = spec.create(api);

          // Tag nodeRef with island metadata for lazy registration (SSR only)
          // Registration happens atomically during decoration, ensuring only
          // actually-rendered islands are registered for hydration.
          const ssrContext = getActiveSSRContext();

          if (ssrContext) nodeRef.__islandMeta = { type: id, props };

          return nodeRef;
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
