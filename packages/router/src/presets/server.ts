/**
 * Server Routing Preset (SSR)
 *
 * Provides routing for server-side rendering. Routes are static snapshots
 * based on the initial request path. No navigation or client-side features.
 */

import { createApi } from '@lattice/lattice';
import type { SealedSpec } from '@lattice/view/types';
import { create as createComponent } from '@lattice/view/component';
import { defaultExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { createRouteFactory } from '../route';
import { createLocationFactory } from '../location';
import {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '@lattice/islands/renderers/dom-server';

// Signals API type (matches islands pattern but with computed)
type SignalsApi = {
  signal: <T>(value: T) => {
    (): T;
    (value: T): void;
    peek(): T;
  };
  computed: <T>(fn: () => T) => {
    (): T;
    peek(): T;
  };
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
};

// Server-specific router config
export interface ServerRouterConfig {
  signals: SignalsApi;
  requestPath: string;  // Required: the path to render
}

/**
 * Create server router API for SSR
 */
export const createServerRouterApi = (config: ServerRouterConfig) => {
  const { signals, requestPath } = config;

  // Create renderer
  const renderer = createDOMServerRenderer();

  // Create view helpers (scopes, signal, effect, batch)
  const viewHelpers = createSpec(renderer, signals);

  // Create view extensions (el, map, match, show)
  const views = createApi(defaultExtensions<DOMServerRendererConfig>(), viewHelpers);

  // Server: currentPath is fixed to the request path
  const currentPath = signals.signal(requestPath);

  // Server: navigate is a no-op (just updates signal for consistency)
  const navigate = (path: string): void => {
    currentPath(path);
    // No window.history in SSR
  };

  // Create router context with all dependencies
  // Use signals directly instead of viewHelpers to get the right types
  const routerContext = {
    signal: signals.signal,
    computed: signals.computed,
    effect: signals.effect,
    batch: signals.batch,
    scopedEffect: viewHelpers.scopedEffect,
    createElementScope: viewHelpers.createElementScope,
    onCleanup: viewHelpers.onCleanup,
    disposeScope: viewHelpers.disposeScope,
    getElementScope: viewHelpers.getElementScope,
    renderer,
    el: views.el,
    match: views.match,
    show: views.show,
    currentPath,
    navigate,
  };

  // Create router extensions (route, location)
  const routerExtensions = createApi(
    {
      route: createRouteFactory<DOMServerRendererConfig>(),
      location: createLocationFactory(),
    },
    routerContext
  );

  return {
    ...signals,
    ...views,
    ...routerExtensions,
    navigate,
    currentPath,
    mount: <TElement>(spec: SealedSpec<TElement>) => spec.create(),
    create: createComponent,
  };
};

export type ServerRouterApi = ReturnType<typeof createServerRouterApi>;
