/**
 * Counter Island - Interactive component that ships JS to client
 */
import { island } from '@lattice/islands/island';
import type { Service } from '../service.js';

type CounterProps = { initialCount: number };

export const Counter = island<CounterProps, Service>(
  'counter',
  ({ el, signal }) =>
    (props) => {
      const count = signal(props.initialCount);
      const inc = () => count(count() + 1);
      const dec = () => count(count() - 1);

      return el('div', { className: 'counter' })(
        el('button', { onclick: dec })('-'),
        el('span', { className: 'counter-value' })(() => `Count: ${count()}`),
        el('button', { onclick: inc })('+')
      );
    }
);
