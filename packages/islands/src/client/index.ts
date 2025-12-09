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

// Context management
export { setClientContext } from '../client-context.browser';

// Types
export type { IslandComponent, IslandStrategy, GetContext } from '../types';
