import { create } from '../api';
import { useCounter } from '../behaviors/useCounter';

export const Counter = create((api) => (initialCount: number = 0) => {
  const { el, addEventListener, computed } = api;
  const { decrement, increment, reset, count, doubled } = useCounter(api, initialCount);
  const decrementBtn = el('button')('- Decrement')(addEventListener('click', decrement));
  const incrementBtn = el('button')('+ Increment')(addEventListener('click', increment));
  const resetBtn = el('button')('Reset')(addEventListener('click', reset));

  return el('div', { className: 'example' })(
    el('h2')('Counter Example'),
    el('p')('Demonstrates reactive text updates and event handlers.'),
    el('div', { className: 'counter-display' })(
      computed(() => `Count: ${count()} (doubled: ${doubled()})`)
    ),
    el('div')(decrementBtn, incrementBtn, resetBtn)
  );
});
