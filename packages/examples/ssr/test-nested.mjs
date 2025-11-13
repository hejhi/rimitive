import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';
import {
  createSSRContext,
  runWithSSRContext,
  renderToString,
} from '@lattice/data';
import { create } from '@lattice/view/component';
import { island } from '@lattice/data/island';

console.log('Testing nested el() calls...');

const NestedComponent = island(
  'nested',
  create((api) => {
    return (props) => {
      const { el } = api;
      console.log('[Nested] Building nested structure...');

      const result = el('div', { className: 'container' })(
        el('h2')('Title')(),
        el('p')('Paragraph')()
      )();

      console.log('[Nested] Built successfully');
      return result;
    };
  })
);

const signals = createSignalsApi();
const { mount } = createSSRApi(signals);
const ctx = createSSRContext();

console.log('Rendering...');
const html = runWithSSRContext(ctx, () => {
  const rendered = mount(NestedComponent({ }));
  return renderToString(rendered);
});

console.log('HTML:', html);
console.log('SUCCESS!');
