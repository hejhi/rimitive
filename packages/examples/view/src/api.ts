/**
 * App-level API
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { createApi } from '@lattice/lattice';
import {
  ComponentFactory,
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers
} from '@lattice/view/presets/core';
import {
  defaultExtensions as defaultSignalsExtensions,
  defaultHelpers as defaultSignalsHelpers
} from '@lattice/signals/presets/core';
import { createDOMRenderer, DOMRendererConfig } from '@lattice/view/renderers/dom';
import { SealedSpec } from '@lattice/view/types';
import { create as createComponent } from '@lattice/view/component';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

export const signals = createApi(defaultSignalsExtensions(), defaultSignalsHelpers());

const viewHelpers = defaultViewHelpers(createDOMRenderer(), signals);

export const views = createApi(defaultViewExtensions<DOMRendererConfig>(), viewHelpers);
export const mount = <TElement>(spec: SealedSpec<TElement>) => spec.create(views);
export const api = {
  ...signals,
  ...views,
  addEventListener: createAddEventListener(viewHelpers.batch),
};
export const create = createComponent as ComponentFactory<typeof api>;

export type Signals = typeof signals;
export type DOMViews = typeof views;
export type CoreApi = typeof api;

