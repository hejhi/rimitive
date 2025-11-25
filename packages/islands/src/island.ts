/**
 * Island Wrapper - Server version
 *
 * Marks components as islands - interactive regions that ship JavaScript to the client.
 * Static content remains as HTML without hydration overhead.
 */

import type { LifecycleCallback } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from './types';
import type { RefSpec } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import { ISLAND_META } from './types';
import { getActiveSSRContext } from './ssr-context';

/**
 * Mark a component as an island
 *
 * Islands are interactive components that ship JavaScript to the client.
 * During SSR, islands register themselves for hydration.
 * On the client, islands hydrate from server-rendered HTML.
 *
 * Island components receive the API at instantiation time to support proper hydration.
 */
export function island<TProps, TApi = Record<string, unknown>>(
  id: string,
  factory: (api: TApi) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

/**
 * Mark a component as an island with custom hydration strategy
 */
export function island<TProps, TApi = Record<string, unknown>>(
  id: string,
  strategy: IslandStrategy<TProps>,
  factory: (api: TApi) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps, TApi = Record<string, unknown>>(
  id: string,
  strategyOrFactory:
    | IslandStrategy<TProps>
    | ((api: TApi) => (props: TProps) => RefSpec<unknown>),
  maybeFactory?: (api: TApi) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  // Determine if second arg is strategy or factory
  const factory =
    maybeFactory ||
    (strategyOrFactory as (api: TApi) => (props: TProps) => RefSpec<unknown>);

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
          const component = factory(api); // NOW call factory with the API to get the component function
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
