/**
 * Island Wrapper
 *
 * Marks components as islands - interactive regions that ship JavaScript to the client.
 * Static content remains as HTML without hydration overhead.
 */

import type { SealedSpec } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy, IslandMetaData } from './types';
import { ISLAND_META } from './types';
import { getActiveSSRContext, registerIsland } from './ssr-context';


/**
 * Mark a component as an island
 *
 * Islands are interactive components that ship JavaScript to the client.
 * During SSR, islands register themselves for hydration.
 * On the client, islands hydrate from server-rendered HTML.
 *
 * @param id - Unique island type identifier (e.g., "counter", "cart")
 * @param component - Component function that returns a SealedSpec
 * @returns Wrapped component with island metadata
 *
 * @example
 * ```ts
 * const Counter = island('counter',
 *   create(({ el, signal }) => (props: { initialCount: number }) => {
 *     const count = signal(props.initialCount);
 *     return el('button', { onClick: () => count(count() + 1) })(
 *       `Count: ${count()}`
 *     )();
 *   })
 * );
 *
 * // Server: renders to HTML + registers for hydration
 * const html = renderToString(mount(Counter({ initialCount: 5 })));
 *
 * // Client: hydrates from existing HTML
 * const hydrator = createDOMIslandHydrator();
 * hydrator.hydrate({ counter: Counter });
 * ```
 */
export function island<TProps>(
  id: string,
  component: (props: TProps) => SealedSpec<unknown>
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
  component: (props: TProps) => SealedSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps>(
  id: string,
  strategyOrComponent: IslandStrategy<TProps> | ((props: TProps) => SealedSpec<unknown>),
  maybeComponent?: (props: TProps) => SealedSpec<unknown>
): IslandComponent<TProps> {
  // Determine if second arg is strategy or component
  const component = maybeComponent || (strategyOrComponent as (props: TProps) => SealedSpec<unknown>);
  const strategy = maybeComponent ? (strategyOrComponent as IslandStrategy<TProps>) : undefined;

  // Create wrapper function
  const wrapper = ((props: TProps) => {
    // Get the component spec
    const spec = component(props);

    // Check if we're in SSR context
    const ctx = getActiveSSRContext();

    if (ctx) {
      // Server-side: Register island and tag nodeRef
      const instanceId = registerIsland(id, props);

      // Wrap spec.create to tag the returned nodeRef
      const originalCreate = spec.create.bind(spec);
      spec.create = function(...args: unknown[]) {
        const nodeRef = originalCreate(...args);
        // Tag nodeRef with island ID for renderToString
        (nodeRef as { __islandId?: string }).__islandId = instanceId;
        return nodeRef;
      };
    }

    // Client-side or no SSR context: return spec as-is
    return spec;
  }) as IslandComponent<TProps>;

  // Attach metadata for hydrator to read
  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy } as IslandMetaData<TProps>,
    enumerable: false,
  });

  return wrapper;
}
