/**
 * Client-side hydration
 *
 * Loads island components and hydrates them from server-rendered HTML.
 */
import { createDOMIslandHydrator, type CreateAPIFn, type IslandRegistry } from '@lattice/data/hydrators/dom';
import { defaultHelpers } from '@lattice/view/presets/core';
import { signals, mount } from './api';
import { Counter } from './islands/Counter';
import { TodoList } from './islands/TodoList';

// Create hydrator with client-side API
const hydrator = createDOMIslandHydrator(
  defaultHelpers as unknown as CreateAPIFn,
  signals,
  mount
);

// Hydrate all islands
hydrator.hydrate({
  counter: Counter,
  todolist: TodoList,
} as IslandRegistry);

console.log('Islands hydrated!');
