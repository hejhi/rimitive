/**
 * @lattice/islands - Islands Architecture for Server-Side Rendering
 *
 * Provides fine-grained hydration for Lattice applications.
 * Only interactive components ("islands") ship JavaScript to the client.
 *
 * This main entry point contains browser-safe exports only.
 * Server-only APIs are available from '@lattice/islands/server'.
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

// Note: `island` is NOT exported here - import from '@lattice/islands/island'
// This ensures proper browser/server conditional exports are used

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
// For server-side, import from '@lattice/islands/server'
export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
} from './presets/islands-app';

// Island factory for typed islands
export { createIsland, type IslandFactory } from './factory';
