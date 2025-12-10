/**
 * Server Module
 *
 * Server-side utilities for SSR.
 */

// Render to string
export {
  renderToString,
  renderToStringAsync,
  renderToStringAsyncWithHydration,
  collectHydrationData,
  createHydrationScript,
} from '../deps/renderToString';
export type {
  AsyncRenderable,
  RenderToStringAsyncOptions,
  RenderWithHydrationOptions,
  RenderWithHydrationInlineResult,
  HydrationData,
} from '../deps/renderToString';

// Async fragment utilities (server-side)
export {
  isAsyncFragment,
  collectAsyncFragments,
  resolveAsyncFragment,
  ASYNC_FRAGMENT,
} from '../deps/async-fragments';
export type { AsyncFragment } from '../deps/async-fragments';

// Server adapter
export { createDOMServerAdapter } from '../adapters/dom-server';
