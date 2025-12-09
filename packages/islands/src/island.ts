/**
 * Island Wrapper - Server version
 *
 * Marks components as islands - interactive regions that ship JavaScript to the client.
 * Static content remains as HTML without hydration overhead.
 *
 * Islands receive the service (svc) as their only argument. Any context (user info,
 * current path, etc.) should be part of the service - not a separate mechanism.
 */

import type { RefSpec } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from './types';
import { ISLAND_META } from './types';
import { getActiveSSRContext } from './ssr-context';

/**
 * Mark a component as an island
 *
 * Islands are interactive components that ship JavaScript to the client.
 * During SSR, islands register themselves for hydration.
 * On the client, islands hydrate from server-rendered HTML.
 *
 * Island components receive the service (svc) which contains everything needed:
 * el, signal, computed, and any user-defined context like currentPath.
 *
 * @example
 * ```typescript
 * import { island } from '@lattice/islands';
 * import type { IslandSvc } from '@lattice/islands';
 *
 * export const Counter = island<{ initialCount: number }, IslandSvc>(
 *   'counter',
 *   (svc) => ({ initialCount }) => {
 *     const count = svc.signal(initialCount);
 *     return svc.el('button').props({ onclick: () => count(count() + 1) })(count);
 *   }
 * );
 * ```
 */
export function island<TProps, TSvc = Record<string, unknown>>(
  id: string,
  factory: (svc: TSvc) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

/**
 * Mark a component as an island with custom hydration strategy
 *
 * @example
 * ```typescript
 * import { island, type IslandStrategy } from '@lattice/islands';
 * import type { IslandSvc } from '@lattice/islands';
 *
 * const strategy: IslandStrategy<{ value: string }, IslandSvc> = {
 *   onMismatch: (error, container, props, Component, mount) => {
 *     console.warn('Hydration mismatch, preserving form input', error);
 *     return true; // Preserve existing content
 *   }
 * };
 *
 * export const Form = island(
 *   'form',
 *   strategy,
 *   (svc) => ({ value }) => svc.el('input').props({ value })()
 * );
 * ```
 */
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
