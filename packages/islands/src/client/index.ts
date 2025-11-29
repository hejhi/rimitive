/**
 * Client Module
 *
 * Re-exports client-side primitives for island hydration.
 */

export { createDOMHydrator } from '../hydrators/dom';
export type { IslandHydrator, MountFn } from '../hydrators/dom';

// Client renderers
export { createDOMHydrationRenderer } from '../renderers/dom-hydration';
export type { DOMRendererConfig } from '../renderers/dom-hydration';
export { createIslandsRenderer } from '../renderers/islands';
