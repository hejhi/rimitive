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
  createDOMAdapter,
  DOMAdapterConfig,
} from '@lattice/view/adapters/dom';
import { RefSpec } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createText } from '@lattice/view/helpers/text';

const createViewApi = () => {
  const signalsSvc = createSignalsApi();
  const viewHelpers = defaultViewHelpers(createDOMAdapter(), signalsSvc);
  const viewSvc = composeFrom(
    defaultViewExtensions<DOMAdapterConfig>(),
    viewHelpers
  );
  const svc = {
    ...signalsSvc,
    ...viewSvc,
    addEventListener: createAddEventListener(viewHelpers.batch),
    t: createText(signalsSvc.computed),
  };

  return {
    service: {
      signals: signalsSvc,
      view: viewSvc,
    },
    svc,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
};

export const { service, mount, svc } = createViewApi();

export const {
  addEventListener,
  batch,
  computed,
  effect,
  el,
  map,
  match,
  signal,
  subscribe,
  t,
} = svc;

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
