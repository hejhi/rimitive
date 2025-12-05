/**
 * @lattice/islands - Browser entry point
 *
 * Browser-safe version that imports from browser-specific modules.
 */

// Core types
export type {
  IslandComponent,
  IslandStrategy,
  GetContext,
} from './types';

export { HydrationMismatch } from './types';

// Island factory for typed islands - browser version
export { createIsland, type IslandFactory } from './factory.browser';

// Advanced: composable preset (client version) for custom wiring
export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
} from './presets/core.client';
