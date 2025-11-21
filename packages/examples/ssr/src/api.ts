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
  const signals = createSignalsApi();
  const renderer = createDOMRenderer();
  const viewHelpers = defaultHelpers(renderer, signals);
  const views = composeFrom(
    defaultExtensions<DOMRendererConfig>(),
    viewHelpers
  );

  const api = {
    ...signals,
    ...views,
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

export const { api, signals, views, mount, use } = createViewApi();

export type Api = typeof api;
