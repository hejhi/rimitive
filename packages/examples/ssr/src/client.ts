/**
 * Client-side hydration
 *
 * Loads island components and hydrates them from server-rendered HTML.
 */
import { createIslandsClientApp } from '@lattice/islands/presets/islands.client';
import { Counter } from './islands/Counter.js';
import { TodoList } from './islands/TodoList.js';
import { TagList } from './islands/TagList.js';

const { hydrate } = createIslandsClientApp();

hydrate(Counter, TodoList, TagList);
