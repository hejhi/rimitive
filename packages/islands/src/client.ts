/**
 * @lattice/islands/client - Client-safe exports
 *
 * Only includes exports that work in the browser.
 * Does NOT include SSR context or server-only utilities.
 */

// Client-side hydrator
export { createDOMIslandHydrator } from './hydrators/dom';
export type { IslandHydrator, MountFn } from './hydrators/dom';

// Hydrating API wrapper
export { createHydratingApi } from './hydrating-api';
export type { EffectAPI, HydratingAPIResult } from './hydrating-api';

// Types (safe - no runtime imports)
export type { IslandComponent, IslandStrategy, IslandMetaData, IslandRegistryEntry } from './types';

export { HydrationMismatch, ISLAND_META } from './types';
