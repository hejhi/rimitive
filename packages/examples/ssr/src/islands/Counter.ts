/**
 * Counter Island - Interactive component that ships JS to client
 */
import { island } from '@lattice/islands/island';
import { api, use } from '../api.js';

type CounterProps = { initialCount: number };

// "Headless" component
const useCounter = use(({ signal }) => {
  return ({ initialCount }: { initialCount: number }) => {
    const count = signal(initialCount);

    return {
      count,
      inc: () => count(count() + 1),
      dec: () => count(count() - 1),
    };
  };
});

export const Counter = island<CounterProps, typeof api>('counter', ({ el }) => {
  return (props: CounterProps) => {
    const { count, inc, dec } = useCounter(props);

    return el('div', { className: 'counter' })(
      el('button', { onclick: dec })('-'),
      el('span', { className: 'counter-value' })(() => `Count: ${count()}`),
      el('button', { onclick: inc })('+')
    );
  };
});
