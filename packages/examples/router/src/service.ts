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
  createDOMAdapter,
  DOMAdapterConfig,
} from '@lattice/view/adapters/dom';
import { RefSpec } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createRouter } from '@lattice/router';

const createViewApi = () => {
  const signalSvc = createSignalsApi();
  const adapter = createDOMAdapter();
  const viewHelpers = defaultViewHelpers(adapter, signalSvc);

  // Create base extensions
  const baseExtensions = defaultViewExtensions<DOMAdapterConfig>();

  // Create the views API (without route - that's separate now)
  const viewSvc = composeFrom(baseExtensions, viewHelpers);

  const svc = {
    ...signalSvc,
    ...viewSvc,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };

  // Create router using view API (needs signal and computed from signals)
  const router = createRouter(svc, {
    initialPath:
      typeof window !== 'undefined'
        ? window.location.pathname +
          window.location.search +
          window.location.hash
        : '/',
  });

  type Service = typeof svc;

  return {
    service: {
      view: viewSvc,
      signals: signalSvc,
    },
    router,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
    useSvc: <TReturn>(fn: (svc: Service) => TReturn): TReturn => fn(svc),
  };
};

export const { service, mount, useSvc, router } = createViewApi();

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
