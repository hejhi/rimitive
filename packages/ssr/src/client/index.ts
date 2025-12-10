/**
 * Client Module
 *
 * Client-side utilities for SSR hydration.
 */

// Adapters
export { createDOMHydrationAdapter } from '../adapters/dom-hydration';
export { createHydrationAdapter } from '../adapters/hydration';

// Async fragment utilities (client-side)
export {
  triggerAsyncFragment,
  triggerAsyncFragments,
  collectAsyncFragments,
  isAsyncFragment,
  ASYNC_FRAGMENT,
} from '../deps/async-fragments';
export type { AsyncFragment } from '../deps/async-fragments';

// Hydration adapter helpers
export {
  withAsyncSupport,
  withHydrationData,
  createWindowHydrationStore,
  clearWindowHydrationData,
} from '../deps/hydration-adapters';
export type { HydrationDataStore } from '../deps/hydration-adapters';

// Types
export { HydrationMismatch } from '../types';
