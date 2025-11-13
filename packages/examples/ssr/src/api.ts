/**
 * Shared API for islands
 *
 * This provides the type-safe API that island components use.
 * On the server, we use SSR renderer. On the client, DOM renderer.
 */
import { createApi } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions, defaultHelpers, type ComponentFactory } from '@lattice/view/presets/core';
import { createDOMRenderer, type DOMRendererConfig } from '@lattice/view/renderers/dom';
import type { SealedSpec } from '@lattice/view/types';
import { create as createComponent } from '@lattice/view/component';

// Create view API (for client-side)
const createViewApi = () => {
  const signals = createSignalsApi();
  const renderer = createDOMRenderer();
  const viewHelpers = defaultHelpers(renderer, signals);
  const views = createApi(defaultExtensions<DOMRendererConfig>(), viewHelpers);

  const api = {
    ...signals,
    ...views,
  };

  return {
    api,
    signals,
    views,
    mount: <TElement>(spec: SealedSpec<TElement>) => spec.create(views),
    create: createComponent as ComponentFactory<typeof api>,
  };
};

export const { api, signals, views, mount, create } = createViewApi();

export type Api = typeof api;
