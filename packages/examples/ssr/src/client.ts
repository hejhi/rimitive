/**
 * Client-side hydration
 *
 * Loads island components and hydrates them from server-rendered HTML.
 */
import { createDOMIslandHydrator, type CreateAPIFn, type IslandRegistry } from '@lattice/data/hydrators/dom';
import { createApi } from '@lattice/lattice';
import { defaultHelpers, defaultExtensions } from '@lattice/view/presets/core';
import { createDOMRenderer, type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { signals, mount } from './api';
import { Counter } from './islands/Counter';
import { TodoList } from './islands/TodoList';

// Create API factory for hydrator
const createFullAPI: CreateAPIFn = () => {
  const helpers = defaultHelpers(createDOMRenderer(), signals);
  const views = createApi(defaultExtensions<DOMRendererConfig>(), helpers);
  return {
    ...signals,
    ...views,
  } as ReturnType<CreateAPIFn>;
};

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
