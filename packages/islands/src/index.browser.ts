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
  createIslandsAdapter,
  type DOMAdapterConfig,
} from './presets/island-client';

// Service adapter type
export type { ServiceResult } from './types';

// Unified islands app preset (client version)
export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
} from './presets/islands-app';

// Island factory for typed islands - browser version
export { createIsland, type IslandFactory } from './factory.browser';
