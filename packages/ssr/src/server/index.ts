/**
 * Server Module
 *
 * Server-side utilities for SSR rendering.
 *
 * @example
 * ```ts
 * import {
 *   createDOMServerAdapter,
 *   renderToString,
 *   renderToStringAsync,
 *   renderToStream,
 *   createStreamWriter,
 * } from '@rimitive/ssr/server';
 * ```
 */

// Render functions
export { renderToString, renderToStringAsync, renderToStream } from './render';
export type {
  AsyncRenderable,
  RenderToStringAsyncOptions,
  RenderToStreamOptions,
  StreamResult,
} from './render';

// Server adapter
export { createDOMServerAdapter } from './adapter';
export type { Serialize, ServerAdapterResult } from './adapter';

// Streaming
export { createStreamWriter, safeJsonStringify } from './stream';
export type { StreamWriter } from './stream';

// Async fragment utilities (server-side)
export {
  isAsyncFragment,
  collectAsyncFragments,
  ASYNC_FRAGMENT,
} from '../shared/async-fragments';
export type { AsyncFragment } from '../shared/async-fragments';
