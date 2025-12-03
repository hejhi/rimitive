/**
 * Counter Island - Interactive component that ships JS to client
 */
import { island } from '../service.js';

export const Counter = island(
  'counter',
  ({ el, signal }) =>
    ({ initialCount }: { initialCount: number }) => {
      const count = signal(initialCount);
      const inc = () => count(count() + 1);
      const dec = () => count(count() - 1);

      return el('div').props({ className: 'counter' })(
        el('button').props({ onclick: dec })('-'),
        el('span').props({ className: 'counter-value' })(
          () => `Count: ${count()}`
        ),
        el('button').props({ onclick: inc })('+')
      );
    }
);
