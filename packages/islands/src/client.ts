/**
 * @lattice/islands/client - Client-safe exports
 *
 * Only includes exports that work in the browser.
 * Does NOT include SSR context or server-only utilities.
 */

// Client-side hydrator
export { createDOMHydrator } from './hydrators/dom';
export type { IslandHydrator, MountFn } from './hydrators/dom';

// Types (safe - no runtime imports)
export type {
  IslandComponent,
  IslandStrategy,
  IslandMetaData,
  IslandRegistryEntry,
} from './types';

export { HydrationMismatch, ISLAND_META } from './types';
