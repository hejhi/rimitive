/**
 * Island Wrapper - Server version
 *
 * Marks components as islands - interactive regions that ship JavaScript to the client.
 * Static content remains as HTML without hydration overhead.
 */

import type { NodeRef, LifecycleCallback } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from './types';
import type { RefSpec } from '@lattice/view/types';
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
 * @param id - Unique island type identifier (e.g., "counter", "cart")
 * @param component - Component function that returns a RefSpec (from el, map, etc.)
 * @returns Wrapped component with island metadata
 *
 * @example
 * ```ts
 * const Counter = island('counter',
 *   use(({ el, signal }) => (props: { initialCount: number }) => {
 *     const count = signal(props.initialCount);
 *     return el('button', { onClick: () => count(count() + 1) })(
 *       `Count: ${count()}`
 *     );
 *   })
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
export function island<TProps>(
  id: string,
  component: (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

/**
 * Mark a component as an island with custom hydration strategy
 *
 * @param id - Unique island type identifier
 * @param strategy - Custom hydration strategy (handles mismatches, etc.)
 * @param component - Component function
 */
export function island<TProps>(
  id: string,
  strategy: IslandStrategy<TProps>,
  component: (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps>(
  id: string,
  strategyOrComponent: IslandStrategy<TProps> | ((props: TProps) => RefSpec<unknown>),
  maybeComponent?: (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  // Determine if second arg is strategy or component
  const component =
    maybeComponent ||
    (strategyOrComponent as (props: TProps) => RefSpec<unknown>);
  const strategy = maybeComponent ? (strategyOrComponent as IslandStrategy<TProps>) : undefined;

  // Create wrapper function
  const wrapper = ((props: TProps): RefSpec<unknown> => {
    const spec = component(props); // Get the component spec

    if (!getActiveSSRContext()) return spec;

    // Server-side: Register island and tag nodeRef
    const instanceId = registerIsland(id, props);

    const wrapper: RefSpec<unknown> = Object.assign(
      (...callbacks: LifecycleCallback<unknown>[]) => spec(...callbacks),
      {
        status: spec.status,
        create(api?: unknown) {
          const nodeRef = spec.create(api) as IslandNodeRef<unknown>;

          // Tag nodeRef with island ID for renderToString
          nodeRef.__islandId = instanceId;

          // For ElementRefs: also set a DOM attribute so it's preserved in outerHTML
          // This handles the case where renderToString uses outerHTML
          // and doesn't traverse the nodeRef tree
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

          // FragmentRefs don't need DOM attributes - __islandId is enough
          // renderToString will detect the __islandId and wrap with fragment markers

          return nodeRef;
        },
      }
    );

    return wrapper;
  });

  // Attach metadata for registry construction (includes component for unwrapping)
  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy, component },
    enumerable: false,
  });

  return wrapper;
}
