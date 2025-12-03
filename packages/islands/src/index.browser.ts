/**
 * @lattice/islands - Browser entry point
 *
 * Browser-safe version that imports from browser-specific modules.
 */

// Core types (browser-safe)
export type {
  SSRContext,
  IslandMetadata,
  IslandComponent,
  IslandStrategy,
  IslandMetaData,
  GetContext,
} from './types';

export { HydrationMismatch, ISLAND_META } from './types';

// Client-side hydrator
export { createDOMHydrator } from './hydrators/dom';
export type { IslandHydrator, MountFn } from './hydrators/dom';

// Island-aware client adapters (hydration)
export {
  createDOMHydrationAdapter,
  type DOMAdapterConfig,
} from './adapters/dom-hydration';
export { createIslandsAdapter } from './adapters/islands';

// Service adapter type
export type { ServiceResult } from './types';

// Unified islands app preset (client version)
export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
} from './presets/core.client';

// Island factory for typed islands - browser version
export { createIsland, type IslandFactory } from './factory.browser';
