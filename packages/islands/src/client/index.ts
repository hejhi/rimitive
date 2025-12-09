/**
 * Client Module
 *
 * Client-side utilities for islands hydration.
 */

// Hydrator
export { createDOMHydrator } from '../hydrators/dom';

// Adapters
export { createDOMHydrationAdapter } from '../adapters/dom-hydration';
export { createIslandsAdapter } from '../adapters/islands';

// Base island function (for creating typed wrappers)
export { island } from '../island.browser';

// Types
export type { IslandComponent, IslandStrategy, GetContext } from '../types';

// Composable preset (for ssr-router style apps)
export {
  createIslandsApp,
  type ClientApp,
  type ClientOptions,
  type IslandsClientService,
} from '../presets/core.client';
