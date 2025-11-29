/**
 * Counter Island - Interactive component that ships JS to client
 */
import { island } from '../service.js';

export const Counter = island(
  'counter',
  ({ el, signal }) =>
    (props: { initialCount: number }) => {
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
