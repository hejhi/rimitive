import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';
import {
  createSSRContext,
  runWithSSRContext,
  renderToString,
} from '@lattice/data';
import { Counter } from './src/islands/Counter.js';

console.log('1. Creating APIs...');
const signals = createSignalsApi();
const { mount } = createSSRApi(signals);

console.log('2. Creating SSR context...');
const ctx = createSSRContext();

console.log('3. Rendering island within SSR context...');
const html = runWithSSRContext(ctx, () => {
  console.log('4. Mounting Counter island...');
  const rendered = mount(Counter({ initialCount: 5 }));
  console.log('5. Converting to string...');
  return renderToString(rendered);
});

console.log('6. HTML:', html);
console.log('7. Islands registered:', ctx.islands.length);
console.log('SUCCESS!');
