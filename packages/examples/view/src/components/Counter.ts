/**
 * Counter UI Component
 *
 * Uses the create() pattern - no API parameter needed!
 * The API is provided automatically when .create({ api }) is called at the root.
 */

import { create } from '@lattice/view/component';
import { createCounter } from '../behaviors/counter';

export const Counter = create((api) => (initialCount: number = 0) => {
  const { el, on, computed } = api;

  const { decrement, increment, reset, count, doubled } = createCounter(
    api,
    initialCount
  );
  const decrementBtn = el('button')('- Decrement');
  const incrementBtn = el('button')('+ Increment');
  const resetBtn = el('button')('Reset');

  // Attach behavior via RefSpec chaining
  decrementBtn(on('click', decrement));
  incrementBtn(on('click', increment));
  resetBtn(on('click', reset));

  return el('div', { className: 'example' })(
    el('h2')('Counter Example')(),
    el('p')('Demonstrates reactive text updates and event handlers.')(),
    el('div', { className: 'counter-display' })(
      computed(() => `Count: ${count()} (doubled: ${doubled()})`)
    )(),
    el('div')(decrementBtn, incrementBtn, resetBtn)()
  )();
});
