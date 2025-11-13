import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';
import { island } from '@lattice/data/island';
import { create } from '@lattice/view/component';
import {
  createSSRContext,
  runWithSSRContext,
  renderToString,
} from '@lattice/data';

console.log('1. Setup...');
const signals = createSignalsApi();
const { mount } = createSSRApi(signals);

const Counter = island('counter',
  create((api) => (props) => {
    console.log('  Component factory, api keys:', Object.keys(api).join(', '));
    const { el, signal } = api;
    const count = signal(props.initialCount);
    return el('div')(`Count: ${count()}`)();
  })
);

console.log('2. Creating SSR context and rendering...');
const ctx = createSSRContext();

const html = runWithSSRContext(ctx, () => {
  console.log('  3. Calling mount with island...');
  const rendered = mount(Counter({ initialCount: 10 }));
  console.log('  4. Mount returned, converting to string...');
  return renderToString(rendered);
});

console.log('5. HTML:', html);
console.log('6. Islands:', ctx.islands);
console.log('SUCCESS!');
