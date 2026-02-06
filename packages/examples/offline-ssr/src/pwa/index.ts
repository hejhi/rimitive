/**
 * PWA Utilities
 *
 * Copy-able utilities for building offline-first PWAs with Rimitive.
 * These are patterns, not a framework - copy into your project and modify as needed.
 *
 * - status.ts: Reactive loading status
 * - cache.ts: IndexedDB data cache with cache() primitive
 * - hydrate.ts: Hydration helpers
 *
 * Worker communication uses Comlink (see worker.ts and main.ts).
 */

// Status indicator
export { createStatus, type Status, type StatusService, type StatusOptions } from './status';

// Data cache
export {
  createDataCache,
  DataCacheModule,
  type DataCache,
  type DataCacheConfig,
  type CacheFn,
} from './cache';

// Hydration helpers
export {
  createHydrateRegion,
  withViewTransition,
  type HydrateRegion,
  type HydrateOptions,
} from './hydrate';
