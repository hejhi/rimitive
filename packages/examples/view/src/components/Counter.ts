import { el, addEventListener, computed } from '../service';
import { useCounter } from '../behaviors/useCounter';

export const Counter = (initialCount: number = 0) => {
  const { decrement, increment, reset, count, doubled } =
    useCounter(initialCount);
  const decrementBtn = el('button')('- Decrement')(
    addEventListener('click', decrement)
  );
  const incrementBtn = el('button')('+ Increment')(
    addEventListener('click', increment)
  );
  const resetBtn = el('button')('Reset')(addEventListener('click', reset));

  return el('div', { className: 'example' })(
    el('h2')('Counter Example'),
    el('p')('Demonstrates reactive text updates and event handlers.'),
    el('div', { className: 'counter-display' })(
      computed(() => `Count: ${count()} (doubled: ${doubled()})`)
    ),
    el('div')(decrementBtn, incrementBtn, resetBtn)
  );
};
