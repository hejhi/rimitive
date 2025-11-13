import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';
import { create } from '@lattice/view/component';
import { island } from '@lattice/data/island';
import {
  createSSRContext,
  runWithSSRContext,
  renderToString,
} from '@lattice/data';

console.log('1. Creating APIs...');
const signals = createSignalsApi();
const { mount } = createSSRApi(signals);

console.log('2. Creating inline Counter WITHOUT island wrapper...');
const PlainCounter = create((api) => (props) => {
  console.log('  2a. Factory called');
  const { el, signal } = api;
  const count = signal(props.initialCount);
  console.log('  2b. Signal created, value:', count());
  return el('div')(`Count: ${count()}`)();
});

console.log('3. Creating SSR context...');
const ctx = createSSRContext();

console.log('4. Testing PLAIN counter (no island)...');
const plainHtml = runWithSSRContext(ctx, () => {
  console.log('  4a. Mounting...');
  const rendered = mount(PlainCounter({ initialCount: 5 }));
  console.log('  4b. Mounted, converting to string...');
  return renderToString(rendered);
});
console.log('  4c. Plain HTML:', plainHtml);

console.log('5. Now wrapping same component WITH island...');
const IslandCounter = island('counter', PlainCounter);

console.log('6. Calling island function to get spec...');
const spec = IslandCounter({ initialCount: 7 });
console.log('  6a. Got spec, status:', spec.status);

console.log('7. Calling spec.create(api)...');
try {
  const nodeRef = spec.create(mount.__proto__.constructor.prototype);
  console.log('  7a. Got nodeRef!', nodeRef);
} catch (e) {
  console.error('  7ERROR:', e.message);
}
