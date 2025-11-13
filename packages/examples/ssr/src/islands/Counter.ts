/**
 * Counter Island - Interactive component that ships JS to client
 */
import { create } from '@lattice/view/component';
import { island } from '@lattice/data/island';

export const Counter = island(
  'counter',
  create((api) => {
    return (props: { initialCount: number }) => {
      const { el, signal } = api;
      const count = signal(props.initialCount);

      return el('div', { className: 'counter' })(
        el('button', { onclick: () => count(count() - 1) })('-'),
        el('span', { style: 'margin: 0 1rem' })(`Count: ${count()}`),
        el('button', { onclick: () => count(count() + 1) })('+')
      )();
    };
  })
);
