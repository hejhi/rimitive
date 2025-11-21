/**
 * Counter View Component
 *
 * Uses the create() pattern - the API is provided automatically when .create({ api }) is called.
 */

import { useSvc } from '../service';

interface CounterInstance {
  set: (value: number) => void;
  count: () => number;
  doubled: () => number;
  isEven: () => boolean;
}

export const Counter = useSvc(
  ({ el, addEventListener, computed }) =>
    ({ set, count, doubled, isEven }: CounterInstance) => {
      const incrementBtn = el('button')('Increment')(
        addEventListener('click', () => set(count() + 1))
      );
      const decrementBtn = el('button')('Decrement')(
        addEventListener('click', () => set(count() - 1))
      );
      const resetBtn = el('button')('Reset')(
        addEventListener('click', () => set(0))
      );

      return el('section', { className: 'counter-section' })(
        el('h2')('Counter Example'),
        el('div', { className: 'counter-display' })(
          el('p')(computed(() => `Count: ${count()}`)),
          el('p')(computed(() => `Doubled: ${doubled()}`)),
          el('p')(computed(() => `Is Even: ${isEven() ? 'Yes' : 'No'}`))
        ),
        el('div', { className: 'counter-controls' })(
          incrementBtn,
          decrementBtn,
          resetBtn
        )
      );
    }
);
