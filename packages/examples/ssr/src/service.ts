/**
 * Shared API for islands
 *
 * This provides the type-safe API that island components use.
 * On the server, we use SSR renderer. On the client, DOM renderer.
 */
import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions, defaultHelpers } from '@lattice/view/presets/core';
import {
  createDOMRenderer,
  type DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import { RefSpec } from '@lattice/view/types';

// Create view API (for client-side)
const createViewApi = () => {
  const signalSvc = createSignalsApi();
  const renderer = createDOMRenderer();
  const viewHelpers = defaultHelpers(renderer, signalSvc);
  const viewSvc = composeFrom(
    defaultExtensions<DOMRendererConfig>(),
    viewHelpers
  );

  const svc = {
    ...signalSvc,
    ...viewSvc,
  };

  type Service = typeof svc;

  return {
    service: {
      view: viewSvc,
      signals: signalSvc,
    },
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
    useSvc: <TReturn>(fn: (svc: Service) => TReturn): TReturn => fn(svc),
    withSvc: <TReturn>(fn: (svc: Service) => TReturn) => fn,
  };
};

export const { service, mount, useSvc, withSvc } = createViewApi();

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
