/**
 * Island Wrapper - Browser version
 *
 * Client-side version that skips SSR context logic entirely.
 * Creates a wrapper with metadata for the hydrator.
 *
 * Islands receive the service (svc) as their only argument. Any context (user info,
 * current path, etc.) should be part of the service - not a separate mechanism.
 */

import type { RefSpec } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from './types';
import { ISLAND_META } from './types';

export function island<TProps, TSvc = Record<string, unknown>>(
  id: string,
  factory: (svc: TSvc) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps, TSvc = Record<string, unknown>>(
  id: string,
  strategy: IslandStrategy<TProps, TSvc>,
  factory: (svc: TSvc) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps, TSvc = Record<string, unknown>>(
  id: string,
  strategyOrFactory:
    | IslandStrategy<TProps, TSvc>
    | ((svc: TSvc) => (props: TProps) => RefSpec<unknown>),
  maybeFactory?: (svc: TSvc) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  // Determine if second arg is strategy or factory
  const factory =
    maybeFactory ||
    (strategyOrFactory as (svc: TSvc) => (props: TProps) => RefSpec<unknown>);

  const strategy = maybeFactory ? strategyOrFactory : undefined;

  // Create wrapper function
  const wrapper = (props: TProps) => {
    // Create a deferred RefSpec that delays factory execution until create(svc) is called
    const deferredSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create(svc: TSvc) {
        const component = factory(svc); // Pass svc only - context is part of svc
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
