/**
 * Server Render Functions
 *
 * Renders Rimitive components to HTML strings for SSR.
 *
 * - renderToString: Synchronous render
 * - renderToStringAsync: Waits for all async boundaries
 * - renderToData: Data-only rendering (no HTML)
 * - renderToStream: Progressive streaming render
 */

export { renderToString } from './render-to-string';
export { renderToStringAsync } from './render-to-string-async';
export type {
  AsyncRenderable,
  RenderToStringAsyncOptions,
} from './render-to-string-async';
export { renderToData } from './render-to-data';
export type { RenderToDataOptions } from './render-to-data';
export { renderToStream } from './render-to-stream';
export type { RenderToStreamOptions, StreamResult } from './render-to-stream';
