/**
 * Island Wrapper - Server version
 *
 * Marks components as islands - interactive regions that ship JavaScript to the client.
 * Static content remains as HTML without hydration overhead.
 */

import type { LifecycleCallback, RefSpec } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy, IslandContext } from './types';
import { ISLAND_META } from './types';
import { getActiveSSRContext } from './ssr-context';
import { getClientRequestContext } from './client-context';

/**
 * Build IslandContext from available sources
 */
function getIslandContext(): IslandContext {
  // Try SSR context first (server-side)
  const ssrContext = getActiveSSRContext();
  if (ssrContext?.request) {
    const request = ssrContext.request;
    return {
      request: () => request,
    };
  }

  // Try client context (browser)
  const clientGetter = getClientRequestContext();
  if (clientGetter) {
    return {
      request: clientGetter,
    };
  }

  // Fallback: return a stub that throws on access
  return {
    request: () => {
      throw new Error(
        'Request context not available. ' +
          'On server: pass request to createSSRContext(). ' +
          'On client: call setClientRequestContext().'
      );
    },
  };
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
 * 2. context - Framework-provided context ({ request })
 */
export function island<TProps, TApi = Record<string, unknown>>(
  id: string,
  factory: (
    api: TApi,
    context: IslandContext
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

/**
 * Mark a component as an island with custom hydration strategy
 */
export function island<TProps, TApi = Record<string, unknown>>(
  id: string,
  strategy: IslandStrategy<TProps>,
  factory: (
    api: TApi,
    context: IslandContext
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps, TApi = Record<string, unknown>>(
  id: string,
  strategyOrFactory:
    | IslandStrategy<TProps>
    | ((
        api: TApi,
        context: IslandContext
      ) => (props: TProps) => RefSpec<unknown>),
  maybeFactory?: (
    api: TApi,
    context: IslandContext
  ) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  // Determine if second arg is strategy or factory
  const factory =
    maybeFactory ||
    (strategyOrFactory as (
      api: TApi,
      context: IslandContext
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
          // Get island context (request, etc.)
          const context = getIslandContext();

          const component = factory(api, context); // Pass both API and context
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
