/**
 * Counter Island - Interactive component that ships JS to client
 */
import { create } from '../api';
import { island } from '@lattice/data';

export const Counter = island(
  'counter',
  create((api) => (props: { initialCount: number }) => {
    const { el, signal } = api;
    const count = signal(props.initialCount);

    return el('div', { className: 'counter' })(
      el('h2')('Counter Island'),
      el('p')(`Count: ${count()}`),
      el('button', { onclick: () => count(count() + 1) })('Increment'),
      el('button', { onclick: () => count(count() - 1) })('Decrement')
    )();
  })
);
