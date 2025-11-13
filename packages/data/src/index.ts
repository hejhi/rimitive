/**
 * @lattice/data - Islands Architecture for Server-Side Rendering
 *
 * Provides fine-grained hydration for Lattice applications.
 * Only interactive components ("islands") ship JavaScript to the client.
 *
 * @example
 * ```ts
 * // Server-side
 * import { island, createSSRContext, runWithSSRContext } from '@lattice/data';
 * import { renderToString } from '@lattice/view/helpers/renderToString';
 *
 * const Counter = island('counter', create(({ el, signal }) => (props) => {
 *   const count = signal(props.initialCount);
 *   return el('button', { onClick: () => count(count() + 1) })(
 *     `Count: ${count()}`
 *   )();
 * }));
 *
 * const ctx = createSSRContext();
 * const html = runWithSSRContext(ctx, () => renderToString(mount(Counter({ initialCount: 5 }))));
 *
 * // Client-side
 * import { createDOMIslandHydrator } from '@lattice/data';
 *
 * const hydrator = createDOMIslandHydrator();
 * hydrator.hydrate({ counter: Counter });
 * ```
 */

// Core types
export type {
  SSRContext,
  IslandMetadata,
  IslandComponent,
  IslandStrategy,
  IslandMetaData,
} from './types';

export { HydrationMismatch, ISLAND_META } from './types';

// SSR context management
export {
  createSSRContext,
  runWithSSRContext,
  getActiveSSRContext,
  getIslandScripts,
  registerIsland,
} from './ssr-context';

// Island wrapper
export { island } from './island';

// Hydrating API wrapper
export { createHydratingApi } from './hydrating-api';
export type { EffectAPI, HydratingAPIResult } from './hydrating-api';

// Client-side hydrator
export { createDOMIslandHydrator } from './hydrators/dom';
export type { IslandRegistry, IslandHydrator, MountFn } from './hydrators/dom';

// Island-aware renderToString
export { renderToString } from './helpers/renderToString';
