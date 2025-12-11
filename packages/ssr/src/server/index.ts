/**
 * Server Module
 *
 * Server-side utilities for SSR.
 *
 * Async fragment data is managed by createLoader() - use loader.getData()
 * to collect resolved data and serialize it to a script tag for the client.
 */

// Render to string
export { renderToString, renderToStringAsync } from '../deps/renderToString';
export type {
  AsyncRenderable,
  RenderToStringAsyncOptions,
} from '../deps/renderToString';

// Streaming SSR
export { renderToStream } from '../deps/renderToStream';
export type { RenderToStreamOptions, StreamResult } from '../deps/renderToStream';

export { createStreamWriter } from '../deps/stream';
export type { StreamWriter } from '../deps/stream';

// Async fragment utilities (server-side)
export {
  isAsyncFragment,
  collectAsyncFragments,
  ASYNC_FRAGMENT,
} from '../deps/async-fragments';
export type { AsyncFragment } from '../deps/async-fragments';

// Server adapter
export { createDOMServerAdapter } from '../adapters/dom-server';
