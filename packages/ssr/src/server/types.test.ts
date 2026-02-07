/**
 * Type verification tests for SSR server public API.
 *
 * These tests verify that:
 * 1. All exported types are importable and usable
 * 2. Generic type inference works correctly
 * 3. No `any` types leak through the public API surface
 */

import { describe, it, expectTypeOf } from 'vitest';

// Import ALL public types to verify they are properly exported
import type {
  // Render types
  AsyncRenderable,
  RenderToStringAsyncOptions,
  RenderToDataOptions,
  RenderToStreamOptions,
  StreamResult,
  // Parse5 adapter types
  Serialize,
  Parse5AdapterResult,
  Parse5TreeConfig,
  Parse5Element,
  Parse5TextNode,
  Parse5CommentNode,
  Parse5Node,
  // Stream types
  StreamWriter,
  ServerStreamWriter,
  // HTML shell types
  HtmlShellOptions,
  HtmlShell,
  // Service factory types
  ServiceFactoryConfig,
  ServiceRequestOptions,
  ServiceFactoryResult,
  ServiceFactory,
  ConfiguredFactoryConfig,
  ServiceLifecycleHooks,
  RequestScope,
  ErrorResponse,
  // Streaming server types
  StreamingServerConfig,
  StreamingHandler,
  StreamingRequestContext,
  StreamingServiceResult,
  // Static handler types
  StaticHandlerConfig,
  StaticHandler,
  // Data prefetch handler types
  DataPrefetchHandlerConfig,
  DataPrefetchHandler,
  // Dev utility types
  DevErrorPageOptions,
  LogLevel,
  RequestLogEntry,
  RequestLoggerOptions,
  RequestLoggerMiddleware,
  DevServerConfig,
  DevServerResult,
  // Logging types
  SSRLogLevel,
  SSRLogEvent,
  SSRLogEntry,
  SSRLogFormatter,
  SSRLoggerOptions,
  SSRLogger,
  SSRRequestLogger,
  // Async fragment types
  AsyncFragment,
} from './index';

// Import functions used in return type assertions
import {
  createParse5Adapter,
  createStreamWriter,
  safeJsonStringify,
  createServerStreamWriter,
  createHtmlShell,
  createServiceFactory,
  createConfiguredServiceFactory,
  handleServiceError,
  createStreamingServer,
  createStaticHandler,
  createDataPrefetchHandler,
  createDevErrorPage,
  createLogger,
  ConfigValidationError,
} from './index';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RefSpec, NodeRef } from '@rimitive/view/types';

describe('SSR server type exports', () => {
  describe('all types are importable', () => {
    it('render types are defined', () => {
      expectTypeOf<AsyncRenderable<unknown>>().not.toBeAny();
      expectTypeOf<RenderToStringAsyncOptions<unknown>>().not.toBeAny();
      expectTypeOf<RenderToDataOptions>().not.toBeAny();
      expectTypeOf<RenderToStreamOptions>().not.toBeAny();
      expectTypeOf<StreamResult>().not.toBeAny();
    });

    it('parse5 adapter types are defined', () => {
      expectTypeOf<Serialize>().not.toBeAny();
      expectTypeOf<Parse5AdapterResult>().not.toBeAny();
      expectTypeOf<Parse5TreeConfig>().not.toBeAny();
      expectTypeOf<Parse5Element>().not.toBeAny();
      expectTypeOf<Parse5TextNode>().not.toBeAny();
      expectTypeOf<Parse5CommentNode>().not.toBeAny();
      expectTypeOf<Parse5Node>().not.toBeAny();
    });

    it('stream types are defined', () => {
      expectTypeOf<StreamWriter>().not.toBeAny();
      expectTypeOf<ServerStreamWriter>().not.toBeAny();
    });

    it('HTML shell types are defined', () => {
      expectTypeOf<HtmlShellOptions>().not.toBeAny();
      expectTypeOf<HtmlShell>().not.toBeAny();
    });

    it('service factory types are defined', () => {
      expectTypeOf<ServiceFactoryConfig>().not.toBeAny();
      expectTypeOf<ServiceRequestOptions>().not.toBeAny();
      expectTypeOf<ServiceFactoryResult>().not.toBeAny();
      expectTypeOf<ServiceFactory>().not.toBeAny();
      expectTypeOf<ConfiguredFactoryConfig>().not.toBeAny();
      expectTypeOf<ServiceLifecycleHooks>().not.toBeAny();
      expectTypeOf<RequestScope>().not.toBeAny();
      expectTypeOf<ErrorResponse>().not.toBeAny();
    });

    it('streaming server types are defined', () => {
      expectTypeOf<StreamingServerConfig<unknown>>().not.toBeAny();
      expectTypeOf<StreamingHandler>().not.toBeAny();
      expectTypeOf<StreamingRequestContext>().not.toBeAny();
      expectTypeOf<StreamingServiceResult<unknown>>().not.toBeAny();
    });

    it('handler types are defined', () => {
      expectTypeOf<StaticHandlerConfig>().not.toBeAny();
      expectTypeOf<StaticHandler>().not.toBeAny();
      expectTypeOf<DataPrefetchHandlerConfig<unknown>>().not.toBeAny();
      expectTypeOf<DataPrefetchHandler>().not.toBeAny();
    });

    it('dev utility types are defined', () => {
      expectTypeOf<DevErrorPageOptions>().not.toBeAny();
      expectTypeOf<LogLevel>().not.toBeAny();
      expectTypeOf<RequestLogEntry>().not.toBeAny();
      expectTypeOf<RequestLoggerOptions>().not.toBeAny();
      expectTypeOf<RequestLoggerMiddleware>().not.toBeAny();
      expectTypeOf<DevServerConfig>().not.toBeAny();
      expectTypeOf<DevServerResult>().not.toBeAny();
    });

    it('logging types are defined', () => {
      expectTypeOf<SSRLogLevel>().not.toBeAny();
      expectTypeOf<SSRLogEvent>().not.toBeAny();
      expectTypeOf<SSRLogEntry>().not.toBeAny();
      expectTypeOf<SSRLogFormatter>().not.toBeAny();
      expectTypeOf<SSRLoggerOptions>().not.toBeAny();
      expectTypeOf<SSRLogger>().not.toBeAny();
      expectTypeOf<SSRRequestLogger>().not.toBeAny();
    });

    it('async fragment types are defined', () => {
      expectTypeOf<AsyncFragment<unknown>>().not.toBeAny();
    });
  });

  describe('function return types', () => {
    it('createParse5Adapter returns Parse5AdapterResult', () => {
      expectTypeOf(createParse5Adapter).returns.toEqualTypeOf<Parse5AdapterResult>();
    });

    it('createStreamWriter returns StreamWriter', () => {
      expectTypeOf(createStreamWriter).returns.toEqualTypeOf<StreamWriter>();
    });

    it('safeJsonStringify returns string', () => {
      expectTypeOf(safeJsonStringify).returns.toEqualTypeOf<string>();
    });

    it('createServerStreamWriter returns ServerStreamWriter', () => {
      expectTypeOf(createServerStreamWriter).returns.toEqualTypeOf<ServerStreamWriter>();
    });

    it('createHtmlShell returns HtmlShell', () => {
      expectTypeOf(createHtmlShell).returns.toEqualTypeOf<HtmlShell>();
    });

    it('createServiceFactory returns ServiceFactory', () => {
      expectTypeOf(createServiceFactory).returns.toEqualTypeOf<ServiceFactory>();
    });

    it('createConfiguredServiceFactory returns ServiceFactory', () => {
      expectTypeOf(createConfiguredServiceFactory).returns.toEqualTypeOf<ServiceFactory>();
    });

    it('createStreamingServer returns StreamingHandler', () => {
      expectTypeOf(createStreamingServer).returns.toEqualTypeOf<StreamingHandler>();
    });

    it('createDataPrefetchHandler returns DataPrefetchHandler', () => {
      expectTypeOf(createDataPrefetchHandler).returns.toEqualTypeOf<DataPrefetchHandler>();
    });

    it('createStaticHandler returns StaticHandler', () => {
      expectTypeOf(createStaticHandler).returns.toEqualTypeOf<StaticHandler>();
    });

    it('handleServiceError returns ErrorResponse', () => {
      expectTypeOf(handleServiceError).returns.toEqualTypeOf<ErrorResponse>();
    });

    it('createLogger returns SSRLogger', () => {
      expectTypeOf(createLogger).returns.toEqualTypeOf<SSRLogger>();
    });

    it('createDevErrorPage returns string', () => {
      expectTypeOf(createDevErrorPage).returns.toEqualTypeOf<string>();
    });
  });

  describe('generic type inference', () => {
    it('StreamingServerConfig infers TSvc from createService', () => {
      type MyService = { signal: () => void; computed: () => void };

      const config: StreamingServerConfig<MyService> = {
        shell: { streamKey: '__APP__' },
        clientSrc: '/client.js',
        createService: () => ({
          service: { signal: () => {}, computed: () => {} } as MyService,
          serialize: (() => '') as Serialize,
          insertFragmentMarkers: () => {},
        }),
        createApp: (service) => {
          // Verify `service` is inferred as MyService
          expectTypeOf(service).toEqualTypeOf<MyService>();
          return {} as RefSpec<unknown>;
        },
        mount: (service) => {
          expectTypeOf(service).toEqualTypeOf<MyService>();
          return () => ({}) as NodeRef<unknown>;
        },
      };

      // Verify the config type flows through
      expectTypeOf(config).toMatchTypeOf<StreamingServerConfig<MyService>>();
    });

    it('DataPrefetchHandlerConfig infers TSvc from createService', () => {
      type MyService = { router: { path: () => string } };

      const config: DataPrefetchHandlerConfig<MyService> = {
        createService: () => ({
          router: { path: () => '/' },
        }),
        createApp: (service) => {
          expectTypeOf(service).toEqualTypeOf<MyService>();
          return {} as RefSpec<unknown>;
        },
        mount: (service) => {
          expectTypeOf(service).toEqualTypeOf<MyService>();
          return () => ({}) as NodeRef<unknown>;
        },
        getData: (service) => {
          expectTypeOf(service).toEqualTypeOf<MyService>();
          return {};
        },
      };

      expectTypeOf(config).toMatchTypeOf<DataPrefetchHandlerConfig<MyService>>();
    });

    it('StreamingServiceResult preserves generic parameter', () => {
      type Svc = { dispose(): void };
      type Result = StreamingServiceResult<Svc>;

      expectTypeOf<Result['service']>().toEqualTypeOf<Svc>();
    });

    it('createStreamingServer infers TSvc from config', () => {
      // The function should accept generic config and return StreamingHandler
      type Config = StreamingServerConfig<{ id: number }>;
      expectTypeOf(createStreamingServer<{ id: number }>).parameter(0).toEqualTypeOf<Config>();
      expectTypeOf(createStreamingServer).returns.toEqualTypeOf<StreamingHandler>();
    });
  });

  describe('handler types are compatible with http module', () => {
    it('StreamingHandler accepts IncomingMessage and ServerResponse', () => {
      expectTypeOf<StreamingHandler>().toBeCallableWith(
        {} as IncomingMessage,
        {} as ServerResponse,
      );
    });

    it('DataPrefetchHandler accepts IncomingMessage and ServerResponse', () => {
      expectTypeOf<DataPrefetchHandler>().toBeCallableWith(
        {} as IncomingMessage,
        {} as ServerResponse,
      );
    });

    it('StreamingHandler returns Promise<void>', () => {
      expectTypeOf<StreamingHandler>().returns.toEqualTypeOf<Promise<void>>();
    });

    it('DataPrefetchHandler returns Promise<boolean>', () => {
      expectTypeOf<DataPrefetchHandler>().returns.toEqualTypeOf<Promise<boolean>>();
    });
  });

  describe('ConfigValidationError', () => {
    it('extends Error', () => {
      expectTypeOf<ConfigValidationError>().toMatchTypeOf<Error>();
    });

    it('has readonly issues property', () => {
      expectTypeOf<ConfigValidationError>().toHaveProperty('issues');
    });
  });

  describe('structural type shapes', () => {
    it('HtmlShell has expected fields', () => {
      expectTypeOf<HtmlShell>().toHaveProperty('start');
      expectTypeOf<HtmlShell>().toHaveProperty('appClose');
      expectTypeOf<HtmlShell['start']>().toBeString();
      expectTypeOf<HtmlShell['appClose']>().toBeString();
    });

    it('ErrorResponse has expected fields', () => {
      expectTypeOf<ErrorResponse>().toHaveProperty('status');
      expectTypeOf<ErrorResponse>().toHaveProperty('body');
      expectTypeOf<ErrorResponse>().toHaveProperty('headers');
      expectTypeOf<ErrorResponse['status']>().toBeNumber();
      expectTypeOf<ErrorResponse['body']>().toBeString();
    });

    it('RequestScope has expected fields', () => {
      expectTypeOf<RequestScope>().toHaveProperty('service');
      expectTypeOf<RequestScope>().toHaveProperty('adapterResult');
      expectTypeOf<RequestScope>().toHaveProperty('dispose');
    });

    it('SSRLogger has request method', () => {
      expectTypeOf<SSRLogger>().toHaveProperty('request');
    });

    it('StreamingRequestContext has expected fields', () => {
      expectTypeOf<StreamingRequestContext>().toHaveProperty('pathname');
      expectTypeOf<StreamingRequestContext>().toHaveProperty('onResolve');
      expectTypeOf<StreamingRequestContext['pathname']>().toBeString();
    });
  });
});
