/**
 * @lattice/islands - Islands Architecture for Server-Side Rendering
 *
 * Provides fine-grained hydration for Lattice applications.
 * Only interactive components ("islands") ship JavaScript to the client.
 *
 * @example
 * ```ts
 * // Server-side
 * import { island, createSSRContext, runWithSSRContext } from '@lattice/islands';
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
 * import { createDOMHydrator } from '@lattice/islands';
 *
 * const hydrator = createDOMHydrator();
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

// Client-side hydrator
export { createDOMHydrator } from './hydrators/dom';
export type { IslandHydrator, MountFn } from './hydrators/dom';

// Island-aware renderToString
export { renderToString } from './helpers/renderToString';

// Island-aware renderer and SSR API
export { createDOMServerRenderer } from './renderers/dom-server';
export { createIslandSSRApi } from './presets/island-ssr';
export type { IslandSSRApi, IslandSSRViews } from './presets/island-ssr';
