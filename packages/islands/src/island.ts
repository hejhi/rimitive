/**
 * Island Wrapper - Server version
 *
 * Marks components as islands - interactive regions that ship JavaScript to the client.
 * Static content remains as HTML without hydration overhead.
 */

import type { NodeRef, LifecycleCallback } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from './types';
import type { RefSpec } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import { ISLAND_META } from './types';
import { getActiveSSRContext, registerIsland } from './ssr-context';

/**
 * NodeRef tagged with island metadata for SSR
 * @internal
 */
type IslandNodeRef<TElement> = NodeRef<TElement> & {
  __islandId: string;
};

/**
 * Mark a component as an island
 *
 * Islands are interactive components that ship JavaScript to the client.
 * During SSR, islands register themselves for hydration.
 * On the client, islands hydrate from server-rendered HTML.
 *
 * Island components receive the API at instantiation time to support proper hydration.
 *
 * @param id - Unique island type identifier (e.g., "counter", "cart")
 * @param factory - Factory function that receives API and returns component function
 * @returns Wrapped component with island metadata
 *
 * @example
 * ```ts
 * const Counter = island('counter',
 *   (api) => (props: { initialCount: number }) => {
 *     const { el, signal } = api;
 *     const count = signal(props.initialCount);
 *     return el('button', { onClick: () => count(count() + 1) })(
 *       `Count: ${count()}`
 *     );
 *   }
 * );
 *
 * // Server: renders to HTML + registers for hydration
 * const html = renderToString(mount(Counter({ initialCount: 5 })));
 *
 * // Client: hydrates from existing HTML
 * const hydrator = createDOMHydrator();
 * hydrator.hydrate({ counter: Counter });
 * ```
 */
export function island<TProps, TApi = Record<string, unknown>>(
  id: string,
  factory: (api: TApi) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

/**
 * Mark a component as an island with custom hydration strategy
 *
 * @param id - Unique island type identifier
 * @param strategy - Custom hydration strategy (handles mismatches, etc.)
 * @param factory - Factory function that receives API and returns component function
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
          const nodeRef = spec.create(api) as IslandNodeRef<unknown>;

          // Tag nodeRef with island ID for renderToString (SSR only)
          const ssrContext = getActiveSSRContext();
          if (ssrContext) {
            const instanceId = registerIsland(id, props);
            nodeRef.__islandId = instanceId;

            // For ElementRefs: also set a DOM attribute so it's preserved in outerHTML
            if (
              'element' in nodeRef &&
              nodeRef.element &&
              typeof nodeRef.element === 'object'
            ) {
              const element = nodeRef.element as {
                setAttribute?: (name: string, value: string) => void;
              };

              if (element.setAttribute) {
                element.setAttribute('data-island-id', instanceId);
              }
            }
          }

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
