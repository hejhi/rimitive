/**
 * Client-side hydration
 *
 * Loads island components and hydrates them from server-rendered HTML.
 */
import { createDOMHydrator } from '@lattice/islands/hydrators/dom';
import { composeFrom } from '@lattice/lattice';
import { defaultHelpers, defaultExtensions } from '@lattice/view/presets/core';
import { type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { createIslandsRenderer } from '@lattice/islands/renderers/islands';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { service, mount } from './service';
import { Counter } from './islands/Counter.js';
import { TodoList } from './islands/TodoList.js';
import { TagList } from './islands/TagList.js';

const { signals } = service;

// Create API factory for hydrator
// Returns { api, createElementScope } for scope-aware hydration
function createFullAPI(
  renderer: ReturnType<typeof createIslandsRenderer>,
  signalsApi: ReturnType<typeof createSignalsApi>
) {
  const helpers = defaultHelpers<DOMRendererConfig>(renderer, signalsApi);
  const views = composeFrom(defaultExtensions<DOMRendererConfig>(), helpers);

  return {
    api: { ...signalsApi, ...views },
    createElementScope: helpers.createElementScope,
  };
}

// Create hydrator with client-side API
const hydrator = createDOMHydrator(createFullAPI, signals, mount);

// Hydrate all islands
hydrator.hydrate(Counter, TodoList, TagList);
