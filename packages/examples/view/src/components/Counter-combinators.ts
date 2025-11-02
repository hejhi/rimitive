/**
 * Counter UI Component (with combinators)
 *
 * Demonstrates how lifecycle combinators reduce boilerplate
 * while maintaining the same functionality.
 */

import type { LatticeViewAPI } from '../types';
import { createCounter } from '../behaviors/counter';
import { pipe } from '@lattice/view/combinators';

export function CounterWithCombinators(api: LatticeViewAPI, initialCount = 0) {
  const { el } = api;

  // Create headless behavior
  const counter = createCounter(api, initialCount);

  // Before: 3 lines per button
  // const decrementBtn = el(['button', '- Decrement']);
  // decrementBtn((btn) => api.on(btn, 'click', () => counter.decrement()));
  //
  // After: 1 line per button using pipe combinator
  const decrementBtn = pipe(
    el(['button', '- Decrement']),
    (btn) => api.on(btn, 'click', () => counter.decrement())
  );

  const incrementBtn = pipe(
    el(['button', '+ Increment']),
    (btn) => api.on(btn, 'click', () => counter.increment())
  );

  const resetBtn = pipe(
    el(['button', 'Reset']),
    (btn) => api.on(btn, 'click', () => counter.reset())
  );

  // Create UI using el() primitive
  return el([
    'div',
    { className: 'example' },
    el(['h2', 'Counter Example (with Combinators)']),
    el(['p', 'Same functionality, 66% less code for lifecycle management.']),
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
