/**
 * Client-side hydration
 *
 * Loads island components and hydrates them from server-rendered HTML.
 */
import { createDOMHydrator } from '@lattice/islands/hydrators/dom';
import { composeFrom } from '@lattice/lattice';
import { defaultHelpers, defaultExtensions } from '@lattice/view/presets/core';
import { type DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createIslandsAdapter } from '@lattice/islands/adapters/islands';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { service, mount } from './service';
import { Counter } from './islands/Counter.js';
import { TodoList } from './islands/TodoList.js';
import { TagList } from './islands/TagList.js';

const { signals } = service;

// Create API factory for hydrator
// Returns { api, createElementScope } for scope-aware hydration
function createFullAPI(
  adapter: ReturnType<typeof createIslandsAdapter>,
  signalsApi: ReturnType<typeof createSignalsApi>
) {
  const helpers = defaultHelpers<DOMAdapterConfig>(adapter, signalsApi);
  const views = composeFrom(defaultExtensions<DOMAdapterConfig>(), helpers);

  return {
    api: { ...signalsApi, ...views },
    createElementScope: helpers.createElementScope,
  };
}

// Create hydrator with client-side API
const hydrator = createDOMHydrator(createFullAPI, signals, mount);

// Hydrate all islands
hydrator.hydrate(Counter, TodoList, TagList);
