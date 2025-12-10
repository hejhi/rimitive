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
  isAsyncFragment,
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

// Server adapter
export { createDOMServerAdapter } from '../adapters/dom-server';
