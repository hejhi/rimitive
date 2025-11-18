/**
 * Client-side hydration
 *
 * Hydrates islands from server-rendered HTML.
 * The router is already rendered in the HTML - no client-side routing needed.
 */
import { createDOMHydrator } from '@lattice/islands/hydrators/dom';
import { createApi } from '@lattice/lattice';
import { defaultHelpers, defaultExtensions } from '@lattice/view/presets/core';
import { type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { createIslandsRenderer } from '@lattice/islands/renderers/islands';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { signals } from './api.js';
import { ProductFilter } from './islands/ProductFilter.js';

// Create API factory for hydrator
function createFullAPI(
  renderer: ReturnType<typeof createIslandsRenderer>,
  signalsApi: ReturnType<typeof createSignalsApi>
) {
  const helpers = defaultHelpers<DOMRendererConfig>(renderer, signalsApi);
  const views = createApi(defaultExtensions<DOMRendererConfig>(), helpers);

  return { ...signalsApi, ...views };
}

// Create mount function (required by hydrator)
function mount<T>(spec: { create: (api: unknown) => T }): T {
  const renderer = createIslandsRenderer();
  const api = createFullAPI(renderer, signals);
  return spec.create(api);
}

// Create hydrator with client-side API
const hydrator = createDOMHydrator(createFullAPI, signals, mount);

// Hydrate all islands
hydrator.hydrate(ProductFilter);

console.log('Client hydrated! Islands are now interactive.');
