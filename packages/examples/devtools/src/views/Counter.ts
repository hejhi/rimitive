/**
 * Counter View Component
 *
 * Uses the create() pattern - the API is provided automatically when .create({ api }) is called.
 */

import { create } from '@lattice/view/component';
import type { RefSpec } from '@lattice/view/types';

interface CounterInstance {
  set: (value: number) => void;
  count: () => number;
  doubled: () => number;
  isEven: () => boolean;
}

export const Counter = create(
  ({ el, on, computed }) =>
    ({
      set,
      count,
      doubled,
      isEven,
    }: CounterInstance): RefSpec<HTMLElement> => {
      const incrementBtn = el('button')('Increment')(
        on('click', () => set(count() + 1))
      );
      const decrementBtn = el('button')('Decrement')(
        on('click', () => set(count() - 1))
      );
      const resetBtn = el('button')('Reset')(on('click', () => set(0)));

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
