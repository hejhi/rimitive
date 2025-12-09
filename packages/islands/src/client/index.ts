/**
 * Client Module
 *
 * Client-side utilities for islands hydration.
 */

// Island-specific hydrator
export { createDOMHydrator } from '../hydrators/dom';

// Re-export SSR client utilities for convenience
export {
  createDOMHydrationAdapter,
  createHydrationAdapter,
  HydrationMismatch,
} from '@lattice/ssr/client';

// Backwards compatibility alias
export { createHydrationAdapter as createIslandsAdapter } from '@lattice/ssr/client';

// Base island function (for creating typed wrappers)
export { island } from '../island.browser';

// Types
export type { IslandComponent, IslandStrategy } from '../types';
