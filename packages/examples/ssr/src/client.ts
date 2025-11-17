/**
 * Client-side hydration
 *
 * Loads island components and hydrates them from server-rendered HTML.
 */
import { createDOMHydrator } from '@lattice/islands/hydrators/dom';
import { createApi } from '@lattice/lattice';
import { defaultHelpers, defaultExtensions } from '@lattice/view/presets/core';
import { type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { createIslandsRenderer } from '@lattice/islands/renderers/islands';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { signals, mount } from './api';
import { Counter } from './islands/Counter.js';
import { TodoList } from './islands/TodoList.js';
import { TagList } from './islands/TagList.js';

// Create API factory for hydrator
function createFullAPI(
  renderer: ReturnType<typeof createIslandsRenderer>,
  signalsApi: ReturnType<typeof createSignalsApi>
) {
  const helpers = defaultHelpers<DOMRendererConfig>(renderer, signalsApi);
  const views = createApi(defaultExtensions<DOMRendererConfig>(), helpers);

  return { ...signalsApi, ...views };
}

// Create hydrator with client-side API
const hydrator = createDOMHydrator(createFullAPI, signals, mount);

// Hydrate all islands
hydrator.hydrate(Counter, TodoList, TagList);
