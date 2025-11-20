/**
 * Counter Island - Interactive component that ships JS to client
 */
import { island } from '@lattice/islands/island';
import { create, use } from '../api.js';

const useCounter = use((api) => {
  return (props: { initialCount: number }) => {
    const { signal } = api;
    const count = signal(props.initialCount);

    return { count };
  };
});

export const Counter = island(
  'counter',
  create((api) => {
    return (props: { initialCount: number }) => {
      const { el } = api;
      const { count } = useCounter(props);

      return el('div', { className: 'counter' })(
        el('button', { onclick: () => count(count() - 1) })('-'),
        el('span', { className: 'counter-value' })(() => `Count: ${count()}`),
        el('button', { onclick: () => count(count() + 1) })('+')
      );
    };
  })
);
