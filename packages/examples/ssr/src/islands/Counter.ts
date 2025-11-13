/**
 * Counter Island - Interactive component that ships JS to client
 */
import { island } from '@lattice/data/island';
import { create } from '../api.js';

export const Counter = island(
  'counter',
  create((api) => {
    return (props: { initialCount: number }) => {
      const { el, signal } = api;
      const count = signal(props.initialCount);

      return el('div', { className: 'counter' })(
        el('button', { onclick: () => count(count() - 1) })('-'),
        el('span', { className: 'counter-value' })(() => `Count: ${count()}`),
        el('button', { onclick: () => count(count() + 1) })('+')
      );
    };
  })
);
