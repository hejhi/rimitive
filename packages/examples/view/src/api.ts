/**
 * App-level API
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { ComponentFactory, defaultExtensions as defaultViewExtensions, defaultHelpers as defaultViewHelpers } from '@lattice/view/presets/core';
import { createApi as createLatticeApi } from '@lattice/lattice';
import { defaultExtensions as defaultSignalsExtensions, defaultHelpers } from '@lattice/signals/presets/core';
import { createDOMRenderer, DOMRendererConfig } from '@lattice/view/renderers/dom';
import { NodeRef, SealedSpec } from '@lattice/view/types';
import { create as createComponent } from '@lattice/view/component';

const renderer = createDOMRenderer();

export const signals = createLatticeApi(defaultSignalsExtensions(), defaultHelpers());
export type Signals = typeof signals;

const viewHelpers = defaultViewHelpers(renderer, signals);

/**
 * DOM-specific API for this app
 * Types are automatically inferred from the renderer
 */
export const views = createLatticeApi(
  defaultViewExtensions<DOMRendererConfig>(),
  viewHelpers
);

export const mount = <TElement>(spec: SealedSpec<TElement>): NodeRef<TElement> =>
  spec.create(views);

export const api = {
  ...signals,
  ...views,
  // Include addEventListener helper from view
  addEventListener: viewHelpers.addEventListener,
};
export type CoreApi = typeof api;

export const create = createComponent as ComponentFactory<typeof api>;
export type DOMViews = typeof views;

