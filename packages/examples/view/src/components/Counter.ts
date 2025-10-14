/**
 * Counter UI Component
 *
 * Uses @lattice/view primitives (el) to create a reactive UI
 * Uses the headless counter behavior for logic
 */

import type { LatticeViewAPI } from '../types';
import type { ElementRef } from '@lattice/view/types';
import { createCounter } from '../behaviors/counter';

export function Counter(api: LatticeViewAPI, initialCount = 0): ElementRef {
  const { el } = api;

  // Create headless behavior
  const counter = createCounter(api, initialCount);

  // Create buttons with event listeners
  const decrementBtn = el(['button', {}, '- Decrement']);
  decrementBtn((el) => {
    const btn = el as HTMLElement;
    btn.addEventListener('click', counter.decrement);
    return () => btn.removeEventListener('click', counter.decrement);
  });

  const incrementBtn = el(['button', {}, '+ Increment']);
  incrementBtn((el) => {
    const btn = el as HTMLElement;
    btn.addEventListener('click', counter.increment);
    return () => btn.removeEventListener('click', counter.increment);
  });

  const resetBtn = el(['button', {}, 'Reset']);
  resetBtn((el) => {
    const btn = el as HTMLElement;
    btn.addEventListener('click', counter.reset);
    return () => btn.removeEventListener('click', counter.reset);
  });

  // Create UI using el() primitive - uses array syntax ['tag', props, ...children]
  return el([
    'div',
    { className: 'example' },
    el(['h2', 'Counter Example']),
    el(['p', 'Demonstrates reactive text updates and event handlers.']),
    el([
      'div',
      { className: 'counter-display' },
      'Count: ',
      // Reactive text - updates when counter.count changes
      counter.count,
      ' (doubled: ',
      counter.doubled,
      ')',
    ]),
    el(['div', {}, decrementBtn, incrementBtn, resetBtn]),
  ]);
}
