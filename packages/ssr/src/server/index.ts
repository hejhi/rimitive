/**
 * Server Module
 *
 * Server-side utilities for SSR rendering.
 *
 * @example Basic rendering
 * ```ts
 * import { createParse5Adapter, renderToString } from '@rimitive/ssr/server';
 * ```
 *
 * @example Streaming server with abstractions
 * ```ts
 * import {
 *   createStreamingServer,
 *   createStaticHandler,
 *   createDataPrefetchHandler,
 *   createHtmlShell,
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

// Streaming server
export { createStreamingServer } from './streaming-server';
export type {
  StreamingServerConfig,
  StreamingHandler,
  StreamingRequestContext,
  StreamingServiceResult,
} from './streaming-server';

// Static file handler
export { createStaticHandler } from './static-handler';
export type { StaticHandlerConfig, StaticHandler } from './static-handler';

// Data prefetch handler
export { createDataPrefetchHandler } from './data-prefetch-handler';
export type { DataPrefetchHandlerConfig, DataPrefetchHandler } from './data-prefetch-handler';

// Development utilities
export {
  createDevErrorPage,
  createRequestLogger,
  installSourceMapSupport,
  createDevServer,
} from './dev';
export type {
  DevErrorPageOptions,
  LogLevel,
  RequestLogEntry,
  RequestLoggerOptions,
  RequestLoggerMiddleware,
  DevServerConfig,
  DevServerResult,
} from './dev';

// Logging
export { createLogger } from './logging';
export type {
  SSRLogLevel,
  SSRLogEvent,
  SSRLogEntry,
  SSRLogFormatter,
  SSRLoggerOptions,
  SSRLogger,
  SSRRequestLogger,
} from './logging';

// Configuration validation
export {
  ConfigValidationError,
  validateStreamingServerConfig,
  validateStaticHandlerConfig,
  validateDataPrefetchHandlerConfig,
  validateDevServerConfig,
} from './validate';

// Async fragment utilities (server-side)
export {
  isAsyncFragment,
  collectAsyncFragments,
  ASYNC_FRAGMENT,
} from '../shared/async-fragments';
export type { AsyncFragment } from '../shared/async-fragments';
