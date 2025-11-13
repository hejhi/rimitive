import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';
import {
  createSSRContext,
  runWithSSRContext,
  renderToString,
} from '@lattice/data';
import { TodoList } from './src/islands/TodoList.js';

console.log('Testing TodoList SSR...');

const signals = createSignalsApi();
const { mount } = createSSRApi(signals);
const ctx = createSSRContext();

console.log('Rendering TodoList...');
const html = runWithSSRContext(ctx, () => {
  const rendered = mount(TodoList({ initialTodos: ['Buy milk', 'Walk dog'] }));
  console.log('Mounted, converting to string...');
  return renderToString(rendered);
});

console.log('HTML:', html);
console.log('Islands:', ctx.islands.length);
console.log('SUCCESS!');
