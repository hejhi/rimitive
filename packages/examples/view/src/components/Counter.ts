/**
 * Counter UI Component
 *
 * Uses @lattice/view primitives (el) to create a reactive UI
 * Uses the headless counter behavior for logic
 */

import type { LatticeViewAPI } from '../types';
import { createCounter } from '../behaviors/counter';

export function Counter(api: LatticeViewAPI, initialCount = 0) {
  const { el } = api;

  // Create headless behavior
  const counter = createCounter(api, initialCount);

  // Create buttons with event listeners
  const decrementBtn = el(['button', '- Decrement'])((btn) => {
    const handler = () => counter.decrement();
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  const incrementBtn = el(['button', '+ Increment'])((btn) => {
    const handler = () => counter.increment();
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  const resetBtn = el(['button', 'Reset'])((btn) => {
    const handler = () => counter.reset();
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  });

  // Create UI using el() primitive
  return el([
    'div',
    { className: 'example' },
    el(['h2', 'Counter Example']),
    el(['p', 'Demonstrates reactive text updates and event handlers.']),
    el([
      'div',
      { className: 'counter-display' },
      api.computed(
        () => `Count: ${counter.count()} (doubled: ${counter.doubled()})`
      ),
    ]),
    el(['div', decrementBtn, incrementBtn, resetBtn]),
  ]);
}
