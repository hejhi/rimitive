/**
 * Client-only service singleton
 *
 * This module is safe for browser bundling as it only imports client-safe code.
 */
import {
  createIslandClientApi,
  type IslandClientSvc,
} from '@lattice/islands/presets/island-client';
import { createRouter } from '@lattice/router';
import type { RefSpec } from '@lattice/view/types';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';

type ServiceOptions = {
  /** Initial path for the router (used for SSR with specific request paths) */
  initialPath?: string;
};

/**
 * The merged service type available to components via useSvc/withSvc
 */
export type MergedService = IslandClientSvc & {
  navigate: (path: string) => void;
};

const createClientServices = (options: ServiceOptions = {}) => {
  const { signals, views, svc } = createIslandClientApi();

  // Create router first so we can include navigate in svc
  // Cast needed because TypeScript has trouble inferring the exact renderer config type
  const router = createRouter<DOMRendererConfig>(svc, {
    initialPath:
      options.initialPath ||
      window.location.pathname + window.location.search + window.location.hash,
  });

  // Include navigate in svc so Link components can access it
  const svcWithNav: MergedService = {
    ...svc,
    navigate: router.navigate,
  };

  return {
    service: {
      view: views,
      signals,
    },
    signals,
    router,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svcWithNav),
    useSvc: <TReturn>(fn: (svc: MergedService) => TReturn): TReturn => fn(svcWithNav),
    withSvc: <TReturn>(fn: (svc: MergedService) => TReturn) => fn,
  };
};

// Lazy initialization - only create services when first accessed in the browser
let _services: ReturnType<typeof createClientServices> | null = null;

function getServices() {
  if (!_services) {
    if (typeof window === 'undefined') {
      throw new Error('Client services can only be accessed in the browser');
    }
    _services = createClientServices();
  }
  return _services;
}

// Export singleton for client-side usage with lazy initialization
// Use getters to delay initialization until first access
export const service = {
  get view() {
    return getServices().service.view;
  },
  get signals() {
    return getServices().service.signals;
  },
};

export function mount<TElement>(spec: RefSpec<TElement>) {
  return getServices().mount(spec);
}

/**
 * Server-compatible connect implementation
 *
 * On server, components are defined at module load time using router.connect().
 * This needs to return a proper component factory structure even without
 * actual router state - the routing state is injected at render time via routeContext.
 *
 * When the per-request router creates routeContext, it includes routeApi with
 * the correct currentPath. serverConnect uses this if available.
 */
function serverConnect<TUserProps>(
  wrapper: (
    routeApi: { navigate: (path: string) => void; currentPath: () => string },
    routeContext: {
      children: unknown[] | null;
      params: () => Record<string, string>;
      routeApi?: {
        navigate: (path: string) => void;
        currentPath: () => string;
      };
    }
  ) => (userProps: TUserProps) => unknown
) {
  return (...args: [TUserProps?]) =>
    (routeContext: {
      children: unknown[] | null;
      params: () => Record<string, string>;
      routeApi?: {
        navigate: (path: string) => void;
        currentPath: () => string;
      };
    }) => {
      // Use routeApi from routeContext if available (injected by per-request router)
      // Fall back to no-op values if not available
      const routeApi = routeContext.routeApi ?? {
        navigate: () => {},
        currentPath: () => '',
      };
      const componentFactory = wrapper(routeApi, routeContext);
      const userProps = args[0] ?? ({} as TUserProps);
      return componentFactory(userProps);
    };
}

// Create a proxy for router to intercept all property accesses
// Returns server-compatible implementations on server, real router on client
export const router = new Proxy(
  {} as ReturnType<typeof createClientServices>['router'],
  {
    get(_target, prop) {
      if (typeof window === 'undefined') {
        // Server: return functional implementations that work at module load time
        if (prop === 'connect') {
          return serverConnect;
        }
        // useCurrentPath needs to return a function that returns a computed-like getter
        if (prop === 'useCurrentPath') {
          return (initialPath: string) => {
            // Return a callable that returns the initial path (mimics ComputedFunction)
            const getter = () => initialPath;
            getter.peek = () => initialPath;
            return getter;
          };
        }
        // Other methods return no-op functions
        return () => {};
      }
      const services = getServices();
      const value = services.router[prop as keyof typeof services.router];
      // Bind methods to preserve 'this' context
      if (typeof value === 'function') {
        return value.bind(services.router);
      }
      return value;
    },
  }
);

/**
 * useSvc - Immediate service access
 *
 * On client: Calls fn(svc) immediately and returns the result
 * On server: Returns a deferred RefSpec that calls fn(api) at create() time
 *
 * The server version creates a RefSpec-like wrapper because:
 * 1. At module load time, svc isn't available (it's per-request)
 * 2. The api IS available when RefSpec.create(api) is called
 * 3. We defer the fn(api) call to create() time
 */
export function useSvc<TReturn>(fn: (svc: MergedService) => TReturn): TReturn {
  if (typeof window === 'undefined') {
    // Server: create a deferred RefSpec that calls fn(api) at create time
    // This bridges the gap between module-load-time definition and request-time rendering
    const lifecycleCallbacks: unknown[] = [];

    // Build refSpec object with proper typing
    const refSpec: {
      (...callbacks: unknown[]): typeof refSpec;
      status: number;
      create: (api: MergedService) => unknown;
    } = Object.assign(
      (...callbacks: unknown[]) => {
        lifecycleCallbacks.push(...callbacks);
        return refSpec;
      },
      {
        // Mark as RefSpec (STATUS_REF_SPEC = 4)
        status: 4,
        // create() receives the api and can finally call fn
        create: (api: MergedService) => {
          // Call fn with the api to get the inner component function
          const innerFn = fn(api);

          // innerFn is typically () => RefSpec (from the useSvc pattern)
          // Call it to get the actual RefSpec
          if (typeof innerFn === 'function') {
            const innerRefSpec = (
              innerFn as () => { create?: (api: unknown) => unknown }
            )();

            // If it has a create method, call it with api
            // Note: RefSpec is a callable function (for lifecycle callbacks),
            // so we check for 'function' not 'object'
            if (
              innerRefSpec &&
              (typeof innerRefSpec === 'function' ||
                typeof innerRefSpec === 'object') &&
              'create' in innerRefSpec
            ) {
              return (
                innerRefSpec as { create: (api: unknown) => unknown }
              ).create(api);
            }

            return innerRefSpec;
          }

          return innerFn;
        },
      }
    );

    return refSpec as unknown as TReturn;
  }
  return getServices().useSvc(fn);
}

/**
 * withSvc - Deferred service access (type helper)
 *
 * Returns the function unchanged - actual service injection happens at render time.
 * Safe for universal code since it doesn't access services.
 */
export function withSvc<TReturn>(fn: (svc: MergedService) => TReturn) {
  return fn;
}

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
