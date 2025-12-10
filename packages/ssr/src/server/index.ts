/**
 * Server Module
 *
 * Server-side utilities for SSR.
 *
 * Async fragment data is now embedded directly in fragment markers
 * by dom-server.ts, so no separate hydration script is needed.
 */

// Render to string
export { renderToString, renderToStringAsync } from '../deps/renderToString';
export type {
  AsyncRenderable,
  RenderToStringAsyncOptions,
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
