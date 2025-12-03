/**
 * Counter View Component
 */
import { el, on, computed } from '../service';
import { useCounter } from '../behaviors/useCounter';

export const Counter = (initialCount = 0) => {
  const { count, doubled, isEven, set } = useCounter(initialCount);

  return el('section').props({ className: 'counter-section' })(
    el('h2')('Counter Example'),
    el('div').props({ className: 'counter-display' })(
      el('p')(computed(() => `Count: ${count()}`)),
      el('p')(computed(() => `Doubled: ${doubled()}`)),
      el('p')(computed(() => `Is Even: ${isEven() ? 'Yes' : 'No'}`))
    ),
    el('div').props({ className: 'counter-controls' })(
      el('button').ref(on('click', () => set(count() + 1)))('Increment'),
      el('button').ref(on('click', () => set(count() - 1)))('Decrement'),
      el('button').ref(on('click', () => set(0)))('Reset')
    )
  );
};
