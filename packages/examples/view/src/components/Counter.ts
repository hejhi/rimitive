import { create } from '../create';
import { createCounter } from '../behaviors/counter';

export const Counter = create((api) => (initialCount: number = 0) => {
  const { el, on, computed } = api;
  const { decrement, increment, reset, count, doubled } = createCounter(api, initialCount);
  const decrementBtn = el('button')('- Decrement')(on('click', decrement));
  const incrementBtn = el('button')('+ Increment')(on('click', increment));
  const resetBtn = el('button')('Reset')(on('click', reset));

  return el('div', { className: 'example' })(
    el('h2')('Counter Example'),
    el('p')('Demonstrates reactive text updates and event handlers.'),
    el('div', { className: 'counter-display' })(
      computed(() => `Count: ${count()} (doubled: ${doubled()})`)
    ),
    el('div')(decrementBtn, incrementBtn, resetBtn)
  );
});
