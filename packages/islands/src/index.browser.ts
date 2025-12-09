/**
 * @lattice/islands - Browser entry point
 *
 * Browser-safe version that imports from browser-specific modules.
 */

// Base island function
export { island } from './island.browser';

// Core types
export type {
  IslandComponent,
  IslandStrategy,
  GetContext,
  IslandMetaData,
} from './types';

export { HydrationMismatch, ISLAND_META } from './types';
