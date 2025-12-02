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
      const incrementBtn = el('button').ref(
        addEventListener('click', () => set(count() + 1))
      )('Increment');
      const decrementBtn = el('button').ref(
        addEventListener('click', () => set(count() - 1))
      )('Decrement');
      const resetBtn = el('button').ref(
        addEventListener('click', () => set(0))
      )('Reset');

      return el('section').props({ className: 'counter-section' })(
        el('h2')('Counter Example'),
        el('div').props({ className: 'counter-display' })(
          el('p')(computed(() => `Count: ${count()}`)),
          el('p')(computed(() => `Doubled: ${doubled()}`)),
          el('p')(computed(() => `Is Even: ${isEven() ? 'Yes' : 'No'}`))
        ),
        el('div').props({ className: 'counter-controls' })(
          incrementBtn,
          decrementBtn,
          resetBtn
        )
      );
    }
);
