/**
 * Service Factory for SSR
 *
 * Creates per-request service instances with automatic adapter setup,
 * loader wiring, and support for custom module injection.
 */

import { compose, type Module, type Use } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { ElModule } from '@rimitive/view/el';
import { MatchModule } from '@rimitive/view/match';
import { createLoaderModule } from '@rimitive/view/load';
import type { Adapter } from '@rimitive/view/types';
import { createParse5Adapter, type Parse5AdapterResult, type Parse5TreeConfig } from './parse5-adapter';

/** The service type returned by the factory. */
type SSRService = Use<Record<string, unknown> & { dispose(): void }>;

/**
 * Options for each per-request service creation.
 */
export type ServiceRequestOptions = {
  /** Hydration data from a prior SSR pass */
  hydrationData?: Record<string, unknown>;
  /** Callback when a load() boundary resolves (for streaming SSR) */
  onResolve?: (id: string, data: unknown) => void;
};

/**
 * Lifecycle hooks for service instances.
 */
export type ServiceLifecycleHooks = {
  /**
   * Called after a service is created, before rendering begins.
   * Use this to perform initialization, logging, or request-scoped setup.
   */
  onCreate?: (service: SSRService, adapterResult: Parse5AdapterResult) => void;
  /**
   * Called when a service is disposed (after response completes or on error).
   * Use this for cleanup, metrics reporting, or resource release.
   */
  onDestroy?: (service: SSRService) => void;
  /**
   * Called when an error occurs during service creation or rendering.
   * Return an HTML string to send as the error response body.
   * If not provided, a default 500 response is generated.
   */
  onError?: (error: unknown) => string | undefined;
};

/**
 * Configuration for createServiceFactory.
 */
export type ServiceFactoryConfig = {
  /**
   * Additional modules to compose after the base SSR modules.
   *
   * Base modules (always included): Signal, Computed, Effect, El, Match, Loader.
   * Custom modules are appended after these and can depend on any base module.
   *
   * @example
   * ```ts
   * const factory = createServiceFactory({
   *   modules: [BatchModule],
   * });
   * ```
   */
  modules?: Module[];
  /**
   * Lifecycle hooks called during service creation and disposal.
   */
  lifecycle?: ServiceLifecycleHooks;
};

/**
 * Result from creating a service via the factory.
 */
export type ServiceFactoryResult = {
  /** The composed service instance */
  service: SSRService;
  /** Parse5 adapter result for rendering */
  adapterResult: Parse5AdapterResult;
};

/**
 * A factory function that creates per-request service instances.
 */
export type ServiceFactory = {
  /**
   * Create a new service instance.
   * Each call creates a fresh Parse5 adapter and service - safe for concurrent requests.
   */
  (options?: ServiceRequestOptions): ServiceFactoryResult;
};

/**
 * A managed service scope that tracks lifecycle and enables automatic cleanup.
 */
export type RequestScope = {
  /** The composed service instance */
  service: SSRService;
  /** Parse5 adapter result for rendering */
  adapterResult: Parse5AdapterResult;
  /** Dispose the service and call onDestroy hooks. Safe to call multiple times. */
  dispose(): void;
};

/**
 * Result from handling a request error.
 */
export type ErrorResponse = {
  /** HTTP status code */
  status: number;
  /** Response body */
  body: string;
  /** Response headers */
  headers: Record<string, string>;
};

/**
 * Create a service factory for SSR.
 *
 * The factory produces per-request service instances with a fresh Parse5 adapter,
 * base SSR modules (Signal, Computed, Effect, El, Match, Loader), and any
 * additional custom modules.
 *
 * Custom modules are composed after the base modules and can depend on
 * any base module (e.g., SignalModule, ComputedModule).
 *
 * @example Basic factory
 * ```ts
 * const factory = createServiceFactory();
 * const { service, adapterResult } = factory();
 * const { serialize, insertFragmentMarkers } = adapterResult;
 * ```
 *
 * @example With custom modules
 * ```ts
 * import { BatchModule } from '@rimitive/signals/extend';
 *
 * const factory = createServiceFactory({
 *   modules: [BatchModule],
 * });
 *
 * const { service, adapterResult } = factory({
 *   hydrationData: { user: { name: 'Alice' } },
 *   onResolve: (id, data) => stream.write(chunkCode(id, data)),
 * });
 * ```
 *
 * @example Streaming SSR
 * ```ts
 * const factory = createServiceFactory();
 * const shell = createHtmlShell({ streamKey: '__APP__' });
 *
 * const { service, adapterResult } = factory({
 *   onResolve: (id, data) => {
 *     if (shell.stream) {
 *       res.write(`<script>${shell.stream.chunkCode(id, data)}</script>`);
 *     }
 *   },
 * });
 *
 * const { initialHtml, done } = renderToStream(appSpec, {
 *   mount: (spec) => spec.create(service),
 *   serialize: adapterResult.serialize,
 *   insertFragmentMarkers: adapterResult.insertFragmentMarkers,
 * });
 * ```
 */
export function createServiceFactory(config: ServiceFactoryConfig = {}): ServiceFactory {
  const { modules: customModules = [], lifecycle } = config;

  return (options: ServiceRequestOptions = {}): ServiceFactoryResult => {
    const adapterResult = createParse5Adapter();
    const { adapter } = adapterResult;

    const baseModules: Module[] = [
      SignalModule,
      ComputedModule,
      EffectModule,
      ElModule.with({ adapter }),
      MatchModule.with({ adapter }),
      createLoaderModule({
        initialData: options.hydrationData,
        onResolve: options.onResolve,
      }),
    ];

    const allModules = [...baseModules, ...customModules];
    const service = (compose as unknown as (...modules: Module[]) => SSRService)(...allModules);

    lifecycle?.onCreate?.(service, adapterResult);

    return { service, adapterResult };
  };
}

/**
 * Configuration for createConfiguredServiceFactory.
 */
export type ConfiguredFactoryConfig = {
  /**
   * Function that receives the per-request adapter and returns additional modules.
   * Called fresh for each service creation so adapter-dependent modules get the right adapter.
   *
   * @example
   * ```ts
   * const factory = createConfiguredServiceFactory({
   *   modules: (adapter) => [
   *     BatchModule,
   *     MapModule.with({ adapter }),
   *     ErrorBoundaryModule.with({ adapter }),
   *   ],
   * });
   *
   * const { service, adapterResult } = factory({ onResolve: handleResolve });
   * ```
   */
  modules: (adapter: Adapter<Parse5TreeConfig>) => Module[];
  /**
   * Lifecycle hooks called during service creation and disposal.
   */
  lifecycle?: ServiceLifecycleHooks;
};

/**
 * Create a service factory with adapter-dependent custom modules.
 *
 * Unlike createServiceFactory which takes static modules, this variant
 * accepts a function that receives the per-request adapter. Use this when
 * custom modules need the adapter (e.g., MapModule, ErrorBoundaryModule).
 */
export function createConfiguredServiceFactory(config: ConfiguredFactoryConfig): ServiceFactory {
  return (options: ServiceRequestOptions = {}): ServiceFactoryResult => {
    const adapterResult = createParse5Adapter();
    const { adapter } = adapterResult;

    const baseModules: Module[] = [
      SignalModule,
      ComputedModule,
      EffectModule,
      ElModule.with({ adapter }),
      MatchModule.with({ adapter }),
      createLoaderModule({
        initialData: options.hydrationData,
        onResolve: options.onResolve,
      }),
    ];

    const customModules = config.modules(adapter);
    const allModules = [...baseModules, ...customModules];
    const service = (compose as unknown as (...modules: Module[]) => SSRService)(...allModules);

    config.lifecycle?.onCreate?.(service, adapterResult);

    return { service, adapterResult };
  };
}

/**
 * Create a managed request scope from a service factory.
 *
 * Wraps a factory call in lifecycle management: the returned `dispose()` method
 * calls `service.dispose()` and fires the factory's `onDestroy` hook. It is
 * idempotent — calling it multiple times is safe.
 *
 * @example Per-request lifecycle
 * ```ts
 * const factory = createServiceFactory({
 *   lifecycle: {
 *     onCreate: (svc) => console.log('service created'),
 *     onDestroy: (svc) => console.log('service destroyed'),
 *   },
 * });
 *
 * const scope = createRequestScope(factory, { hydrationData });
 * try {
 *   const html = renderToString(appSpec, { ... });
 *   res.end(html);
 * } finally {
 *   scope.dispose();
 * }
 * ```
 *
 * @example With streaming
 * ```ts
 * const scope = createRequestScope(factory, { onResolve: handleChunk });
 * const { initialHtml, done } = renderToStream(appSpec, { ... });
 * res.write(initialHtml);
 * await done;
 * scope.dispose();
 * ```
 */
export function createRequestScope(
  factory: ServiceFactory,
  options?: ServiceRequestOptions
): RequestScope {
  const { service, adapterResult } = factory(options);

  let disposed = false;

  return {
    service,
    adapterResult,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        service.dispose();
      } catch {
        // SSR services may not fully support dispose (e.g., modules with
        // runtime-only state). Swallow errors since the service is being
        // discarded after the request anyway.
      }
    },
  };
}

/**
 * Create a default error response for service/rendering failures.
 *
 * If lifecycle `onError` is provided, calls it to get a custom error body.
 * Otherwise returns a minimal 500 HTML response.
 *
 * @example
 * ```ts
 * try {
 *   // render...
 * } catch (error) {
 *   const { status, body, headers } = handleServiceError(error, lifecycle);
 *   res.writeHead(status, headers);
 *   res.end(body);
 * }
 * ```
 */
export function handleServiceError(
  error: unknown,
  lifecycle?: ServiceLifecycleHooks,
): ErrorResponse {
  const customBody = lifecycle?.onError?.(error);

  if (customBody !== undefined) {
    return {
      status: 500,
      body: customBody,
      headers: { 'Content-Type': 'text/html' },
    };
  }

  return {
    status: 500,
    body: '<!DOCTYPE html><html><head><title>Server Error</title></head><body><h1>500 Internal Server Error</h1></body></html>',
    headers: { 'Content-Type': 'text/html' },
  };
}
