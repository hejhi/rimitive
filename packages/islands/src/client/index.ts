/**
 * Client Module
 *
 * Re-exports the DOM hydrator for client-side island hydration.
 */

export { createDOMHydrator } from '../hydrators/dom';
export type { IslandHydrator, MountFn } from '../hydrators/dom';
