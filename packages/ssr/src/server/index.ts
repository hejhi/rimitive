/**
 * Server Module
 *
 * Server-side utilities for SSR rendering.
 *
 * @example
 * ```ts
 * import {
 *   createParse5Adapter,
 *   renderToString,
 *   renderToStringAsync,
 *   renderToStream,
 *   createStreamWriter,
 * } from '@rimitive/ssr/server';
 * ```
 */

// Render functions
export { renderToString, renderToStringAsync, renderToStream, renderToData } from './render';
export type {
  AsyncRenderable,
  RenderToStringAsyncOptions,
  RenderToDataOptions,
  RenderToStreamOptions,
  StreamResult,
} from './render';

// Server adapter
export { createParse5Adapter } from './parse5-adapter';
export type {
  Serialize,
  Parse5AdapterResult,
  Parse5TreeConfig,
  Parse5Element,
  Parse5TextNode,
  Parse5CommentNode,
  Parse5Node,
} from './parse5-adapter';

// Streaming
export { createStreamWriter, safeJsonStringify } from './stream';
export type { StreamWriter } from './stream';

// Server stream writer (higher-level helpers)
export {
  createServerStreamWriter,
  generateChunkScript,
  generateBootstrapScript,
} from './stream-writer';
export type { ServerStreamWriter } from './stream-writer';

// HTML shell
export { createHtmlShell } from './html-shell';
export type { HtmlShellOptions, HtmlShell } from './html-shell';

// Service factory
export {
  createServiceFactory,
  createConfiguredServiceFactory,
  createRequestScope,
  handleServiceError,
} from './create-service-factory';
export type {
  ServiceFactoryConfig,
  ServiceRequestOptions,
  ServiceFactoryResult,
  ServiceFactory,
  ConfiguredFactoryConfig,
  ServiceLifecycleHooks,
  RequestScope,
  ErrorResponse,
} from './create-service-factory';

// Async fragment utilities (server-side)
export {
  isAsyncFragment,
  collectAsyncFragments,
  ASYNC_FRAGMENT,
} from '../shared/async-fragments';
export type { AsyncFragment } from '../shared/async-fragments';
