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
} from '@lattice/view/presets/core';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  createDOMRenderer,
  DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import { RefSpec } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

const createViewApi = () => {
  const signals = createSignalsApi();
  const viewHelpers = defaultViewHelpers(createDOMRenderer(), signals);
  const views = createApi(
    defaultViewExtensions<DOMRendererConfig>(),
    viewHelpers
  );
  const api = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };
  type ApiType = typeof api;

  return {
    api,
    signals,
    views,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(api),
    use: <TReturn>(fn: (api: ApiType) => TReturn): TReturn => fn(api),
  };
};

export const { api, signals, mount, use, views } = createViewApi();

export type Signals = typeof signals;
export type DOMViews = typeof views;
export type CoreApi = typeof api;
