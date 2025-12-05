/**
 * @lattice/islands - Browser entry point
 *
 * Browser-safe version that imports from browser-specific modules.
 * See main index.ts for full documentation and import guide.
 */

// =============================================================================
// Primary API - Island Definition
// =============================================================================

export { island } from './island.browser';
export { createIsland, type IslandFactory } from './factory.browser';

// =============================================================================
// Core Types
// =============================================================================

export type {
  IslandComponent,
  IslandStrategy,
  GetContext,
  IslandMetaData,
} from './types';

export { HydrationMismatch, ISLAND_META } from './types';

// =============================================================================
// Advanced: Composable Presets
// =============================================================================

export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
} from './presets/core.client';
