/**
 * Island Wrapper - Browser version
 *
 * Client-side version that skips SSR context logic entirely.
 * Creates a wrapper with metadata for the hydrator.
 */

import type { NodeRef, LifecycleCallback } from '@lattice/view/types';
import type { RefSpec } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from './types';
import { ISLAND_META } from './types';
import { STATUS_REF_SPEC } from '@lattice/view/types';

export function island<TProps, TApi = Record<string, unknown>>(
  id: string,
  factory: (api: TApi) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

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
  const strategy = maybeFactory
    ? (strategyOrFactory as IslandStrategy<TProps>)
    : undefined;

  // Create wrapper function
  const wrapper = (props: TProps): RefSpec<unknown> => {
    const lifecycleCallbacks: LifecycleCallback<unknown>[] = [];

    // Create a deferred RefSpec that delays factory execution until create(api) is called
    const deferredSpec: RefSpec<unknown> = Object.assign(
      (...callbacks: LifecycleCallback<unknown>[]) => {
        // Collect lifecycle callbacks
        lifecycleCallbacks.push(...callbacks);
        return deferredSpec;
      },
      {
        status: STATUS_REF_SPEC as typeof STATUS_REF_SPEC,
        create(api?: unknown) {
          // NOW call factory with the API to get the component function
          const component = factory(api as TApi);

          // Call component with props to get the actual RefSpec
          const spec = component(props);

          // Apply collected lifecycle callbacks to the spec
          if (lifecycleCallbacks.length > 0) {
            spec(...lifecycleCallbacks);
          }

          // Create the nodeRef
          const nodeRef = spec.create(api) as NodeRef<unknown>;

          return nodeRef;
        },
      }
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
