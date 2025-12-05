/**
 * Island Wrapper - Server version
 *
 * Marks components as islands - interactive regions that ship JavaScript to the client.
 * Static content remains as HTML without hydration overhead.
 */

import type { RefSpec } from '@lattice/view/types';
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
 * 1. svc - The user-defined service svc (el, signal, computed, etc.)
 * 2. getContext - Getter function that returns user-defined context (or undefined)
 */
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

/**
 * Mark a component as an island with custom hydration strategy
 */
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

        const component = factory(svc, getContext); // Pass svc and context getter
        const spec = component(props); // Call component with props to get the actual RefSpec

        // Create the nodeRef
        const nodeRef = spec.create(svc);

        // Tag nodeRef with island metadata for lazy registration (SSR only)
        // Registration happens atomically during decoration, ensuring only
        // actually-rendered islands are registered for hydration.
        const ssrContext = getActiveSSRContext();

        if (ssrContext) nodeRef.__islandMeta = { type: id, props };

        return nodeRef;
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
