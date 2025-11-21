/**
 * App-level API for router example
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { composeFrom } from '@lattice/lattice';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  createDOMRenderer,
  DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import {
  createDOMServerRenderer,
  DOMServerRendererConfig,
} from '@lattice/islands/renderers/dom-server';
import { RefSpec } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createRouter } from '@lattice/router';

const createServices = () => {
  const signalServices = createSignalsApi();
  // Use SSR renderer on server, DOM renderer on client
  const renderer =
    typeof document === 'undefined'
      ? createDOMServerRenderer()
      : createDOMRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signalServices);

  // Create base extensions
  // Use a type that works for both DOM and SSR renderers
  const baseExtensions = defaultViewExtensions<
    DOMRendererConfig | DOMServerRendererConfig
  >();

  // Create the view services
  const viewServices = composeFrom(baseExtensions, {
    ...viewHelpers,
  });

  const svc = {
    ...signalServices,
    ...viewServices,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };

  type MergedService = typeof svc;

  // Create router using view API (needs signal and computed from signals)
  // Router handles popstate internally
  const router = createRouter(svc, {
    initialPath:
      typeof window !== 'undefined'
        ? window.location.pathname +
          window.location.search +
          window.location.hash
        : '/',
  });

  return {
    service: {
      view: viewServices,
      signals: signalServices,
    },
    router,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
    // Pre-bind api for type safety and convenience
    useSvc: <TReturn>(fn: (svc: MergedService) => TReturn): TReturn => fn(svc),
    withSvc: <TReturn>(fn: (svc: MergedService) => TReturn) => fn,
  };
};

export const { service, mount, router, useSvc, withSvc } = createServices();

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
