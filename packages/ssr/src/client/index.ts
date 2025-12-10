/**
 * Client Module
 *
 * Client-side utilities for SSR hydration.
 *
 * Async fragment data is managed by createLoader() - pass initial data
 * from window.__LATTICE_DATA__ (or similar) to seed the loader on the client.
 */

// Adapters
export { createDOMHydrationAdapter } from '../adapters/dom-hydration';
export { createHydrationAdapter } from '../adapters/hydration';

// Async fragment utilities (client-side)
export {
  triggerAsyncFragment,
  collectAsyncFragments,
  isAsyncFragment,
  ASYNC_FRAGMENT,
} from '../deps/async-fragments';
export type { AsyncFragment } from '../deps/async-fragments';

// Adapter wrapper for client-side rendering (non-hydration)
export { withAsyncSupport } from '../deps/hydration-adapters';

// Types
export { HydrationMismatch } from '../types';
