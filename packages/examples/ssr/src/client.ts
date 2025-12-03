/**
 * Client-side hydration
 *
 * Loads island components and hydrates them from server-rendered HTML.
 */
import { createHydrateSvc } from '@lattice/islands/presets/hydrate';
import { Counter } from './islands/Counter.js';
import { TodoList } from './islands/TodoList.js';
import { TagList } from './islands/TagList.js';

const { hydrate } = createHydrateSvc();

hydrate(Counter, TodoList, TagList);
