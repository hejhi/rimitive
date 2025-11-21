/**
 * App-level API
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
import { RefSpec } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

const createViewApi = () => {
  const signalsSvc = createSignalsApi();
  const viewHelpers = defaultViewHelpers(createDOMRenderer(), signalsSvc);
  const viewSvc = composeFrom(
    defaultViewExtensions<DOMRendererConfig>(),
    viewHelpers
  );
  const svc = {
    ...signalsSvc,
    ...viewSvc,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };
  type Service = typeof svc;

  return {
    service: {
      signals: signalsSvc,
      view: viewSvc,
    },
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
    useSvc: <TReturn>(fn: (api: Service) => TReturn): TReturn => fn(svc),
  };
};

export const { service, mount, useSvc } = createViewApi();

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
