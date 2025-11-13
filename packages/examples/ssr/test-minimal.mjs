import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';
import { renderToString } from '@lattice/data/helpers/renderToString';

console.log('1. Creating APIs...');
const signals = createSignalsApi();
const { mount, create } = createSSRApi(signals);

console.log('2. Creating minimal component...');
const MinimalCounter = create((api) => (props) => {
  console.log('3. Component factory called');
  const { el, signal } = api;
  console.log('4. Creating signal...');
  const count = signal(props.initialCount);
  console.log('5. Signal created, reading value...');
  const val = count();
  console.log('6. Value read:', val);
  console.log('7. Creating element...');
  return el('div')(`Count: ${val}`)();
});

console.log('8. Mounting component...');
const rendered = mount(MinimalCounter({ initialCount: 5 }));

console.log('9. Converting to string...');
const html = renderToString(rendered);

console.log('10. HTML:', html);
console.log('SUCCESS!');
