/**
 * Client Module
 *
 * Client-side utilities for SSR hydration.
 *
 * Hydration data is now embedded directly in fragment markers and
 * extracted automatically by createDOMHydrationAdapter. No separate
 * hydration store or window globals needed.
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

// Adapter wrapper for client-side rendering (non-hydration)
export { withAsyncSupport } from '../deps/hydration-adapters';

// Types
export { HydrationMismatch } from '../types';
