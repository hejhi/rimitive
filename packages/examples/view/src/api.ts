/**
 * App-level API
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { createApi } from '@lattice/lattice';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
  type ComponentFactory
} from '@lattice/view/presets/core';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createDOMRenderer, DOMRendererConfig } from '@lattice/view/renderers/dom';
import { SealedSpec } from '@lattice/view/types';
import { create as createComponent } from '@lattice/view/component';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

const createViewApi = () => {
  const signals = createSignalsApi();
  const viewHelpers = defaultViewHelpers(createDOMRenderer(), signals);
  const views = createApi(defaultViewExtensions<DOMRendererConfig>(), viewHelpers);
  const api = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };

  return {
    api,
    signals,
    views,
    mount: <TElement>(spec: SealedSpec<TElement>) => spec.create(api),
    create: createComponent as ComponentFactory<typeof api>,
  };
}

export const { api, signals, mount, create, views } = createViewApi();

export type Signals = typeof signals;
export type DOMViews = typeof views;
export type CoreApi = typeof api;
