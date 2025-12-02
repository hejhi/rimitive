/**
 * Client Module
 *
 * Re-exports client-side primitives for island hydration.
 */

export { createDOMHydrator } from '../hydrators/dom';
export type { IslandHydrator, MountFn } from '../hydrators/dom';

// Client adapters
export { createDOMHydrationAdapter } from '../adapters/dom-hydration';
export type { DOMAdapterConfig } from '../adapters/dom-hydration';
export { createIslandsAdapter } from '../adapters/islands';
