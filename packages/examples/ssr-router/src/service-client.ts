/**
 * Client-only service singleton
 *
 * This module is safe for browser bundling as it only imports client-safe code.
 * Composes signals + view + islands primitives manually for full type inference.
 *
 * Uses a hybrid renderer that starts in hydration mode to adopt SSR'd DOM,
 * then switches to regular DOM renderer for client-side navigation.
 */
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions as defaultViewExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createDOMRenderer, type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { createDOMHydrationRenderer } from '@lattice/islands/renderers/dom-hydration';
import { createIslandsRenderer } from '@lattice/islands/renderers/islands';
import { composeFrom } from '@lattice/lattice';
import { createRouter } from '@lattice/router';
import type { RefSpec, Renderer } from '@lattice/view/types';

/**
 * Create composed client service with signals + views + addEventListener
 *
 * Uses a hybrid renderer that starts in hydration mode for initial mount,
 * then switches to regular DOM renderer for navigation.
 */
function createClientService(signals = createSignalsApi()) {
  // Create hybrid renderer: hydration mode first, then fallback to regular DOM
  const appContainer = document.querySelector('.app') as HTMLElement;
  const hydrationRenderer = appContainer
    ? createDOMHydrationRenderer(appContainer)
    : createDOMRenderer();
  const fallbackRenderer = createDOMRenderer();
  const hybridRenderer = createIslandsRenderer(hydrationRenderer, fallbackRenderer);

  // Cast to base renderer type for createSpec (switchToFallback is still accessible)
  const renderer = hybridRenderer as Renderer<DOMRendererConfig>;

  const viewHelpers = createSpec(renderer, signals);
  const baseExtensions = defaultViewExtensions<DOMRendererConfig>();
  const views = composeFrom(baseExtensions, viewHelpers);

  const svc = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(signals.batch),
  };

  return { signals, views, svc, switchToFallback: hybridRenderer.switchToFallback };
}

/**
 * API factory for hydrator
 * Takes a renderer and signals, returns the full API for island hydration
 */
export const createClientApi = (
  renderer: Renderer<DOMRendererConfig>,
  signals: ReturnType<typeof createSignalsApi>
) => {
  const viewHelpers = createSpec(renderer, signals);
  const views = composeFrom(defaultViewExtensions<DOMRendererConfig>(), viewHelpers);
  return {
    ...signals,
    ...views,
  };
};

/**
 * The merged service type available to components via useSvc
 */
export type MergedService = ReturnType<typeof createClientService>['svc'] & {
  navigate: (path: string) => void;
};

const createClientServices = () => {
  const { signals, views, svc, switchToFallback } = createClientService();

  // Create router with the service (uses hybrid renderer)
  const router = createRouter<DOMRendererConfig>(svc, {
    initialPath:
      window.location.pathname + window.location.search + window.location.hash,
  });

  // Include navigate in svc for components
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
    switchToFallback,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svcWithNav),
    useSvc: <TReturn>(fn: (svc: MergedService) => TReturn): TReturn => fn(svcWithNav),
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
 * Switch renderer from hydration mode to regular DOM mode
 * Call this after initial mount to enable client-side rendering for navigation
 */
export function switchToFallback() {
  return getServices().switchToFallback();
}

/**
 * Router accessor - lazy initialization on client
 *
 * With the new defineRoutes/connect API, components no longer need
 * router.connect() at module load time. The router is only accessed
 * at runtime for navigate(), mount(), and useCurrentPath().
 */
export const router = {
  get navigate() {
    return getServices().router.navigate;
  },
  get currentPath() {
    return getServices().router.currentPath;
  },
  get mount() {
    return getServices().router.mount;
  },
  /**
   * Get a reactive current path for islands
   * On server: returns a mock computed wrapping the initial path
   * On client: returns the router's reactive currentPath
   */
  useCurrentPath(initialPath: string) {
    if (typeof window === 'undefined') {
      // Server: return a mock computed that returns the initial path
      const getter = () => initialPath;
      getter.peek = () => initialPath;
      return getter;
    }
    return getServices().router.useCurrentPath(initialPath);
  },
};

/**
 * useSvc - Immediate service access
 *
 * On client: Calls fn(svc) immediately and returns the result
 * On server: Returns a deferred RefSpec that calls fn(api) at create() time
 */
export function useSvc<TReturn>(fn: (svc: MergedService) => TReturn): TReturn {
  if (typeof window === 'undefined') {
    // Server: create a deferred RefSpec that calls fn(api) at create time
    const lifecycleCallbacks: unknown[] = [];

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
        status: 4, // STATUS_REF_SPEC
        create: (api: MergedService) => {
          const innerFn = fn(api);

          if (typeof innerFn === 'function') {
            const innerRefSpec = (
              innerFn as () => { create?: (api: unknown) => unknown }
            )();

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

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
