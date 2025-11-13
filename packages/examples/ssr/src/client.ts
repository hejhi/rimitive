/**
 * Client-side hydration
 *
 * Loads island components and hydrates them from server-rendered HTML.
 */
import { createDOMIslandHydrator, type IslandRegistry } from '@lattice/data/hydrators/dom';
import { createApi } from '@lattice/lattice';
import { defaultHelpers, defaultExtensions } from '@lattice/view/presets/core';
import { type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { createSwitchableDOMRenderer } from '@lattice/view/renderers/switchable-dom';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { signals, mount } from './api';
import { Counter } from './islands/Counter';
import { TodoList } from './islands/TodoList';

// Create API factory for hydrator
function createFullAPI(
  renderer: ReturnType<typeof createSwitchableDOMRenderer>,
  signalsApi: ReturnType<typeof createSignalsApi>
) {
  const helpers = defaultHelpers<DOMRendererConfig>(renderer, signalsApi);
  const views = createApi(defaultExtensions<DOMRendererConfig>(), helpers);

  return {
    ...signalsApi,
    ...views,
  };
}

// Create hydrator with client-side API
const hydrator = createDOMIslandHydrator(
  createFullAPI,
  signals,
  mount
);

// Hydrate all islands
hydrator.hydrate({
  counter: Counter,
  todolist: TodoList,
} as IslandRegistry);

console.log('Islands hydrated!');
