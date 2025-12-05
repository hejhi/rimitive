/**
 * @lattice/islands - Islands Architecture for Server-Side Rendering
 *
 * Provides fine-grained hydration for Lattice applications.
 * Only interactive components ("islands") ship JavaScript to the client.
 *
 * ## Quick Start
 *
 * ```ts
 * // Define islands with island() from '@lattice/islands/island'
 * import { island } from '@lattice/islands/island';
 *
 * // Server: import from '@lattice/islands/server'
 * import { createIslandsServerApp } from '@lattice/islands/server';
 *
 * // Client: import from '@lattice/islands/client'
 * import { createIslandsClientApp } from '@lattice/islands/client';
 * ```
 */

// Core types
export type {
  IslandComponent,
  IslandStrategy,
  GetContext,
  IslandMetaData,
} from './types';

export { HydrationMismatch, ISLAND_META } from './types';

// Island factory for typed islands
export { createIsland, type IslandFactory } from './factory';

// Advanced: composable preset (client version) for custom wiring
export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
} from './presets/core.client';
