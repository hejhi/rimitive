/**
 * Counter UI Component
 *
 * Uses @lattice/view primitives (el) to create a reactive UI
 * Uses the headless counter behavior for logic
 */

import type { LatticeViewAPI } from '../types';
import type { ElementRef } from '@lattice/view';
import { createCounter } from '../behaviors/counter';

export function Counter(api: LatticeViewAPI, initialCount = 0): ElementRef {
  const { el } = api;

  // Create headless behavior
  const counter = createCounter(api, initialCount);

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
    el([
      'div',
      el(['button', { onClick: counter.decrement }, '- Decrement']),
      el(['button', { onClick: counter.increment }, '+ Increment']),
      el(['button', { onClick: counter.reset }, 'Reset']),
    ]),
  ]);
}
