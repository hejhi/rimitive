/**
 * Counter UI Component
 *
 * Demonstrates separation of pure structure from imperative behavior:
 * - Phase 1 (Pure): Define structure with el(tag, props)(children)
 * - Phase 2 (Imperative): Attach behavior via RefSpec chaining
 * - Phase 3 (Instantiation): Call .create() to build DOM
 */

import type { LatticeViewAPI } from '../types';
import { createCounter } from '../behaviors/counter';

export function Counter(api: LatticeViewAPI, initialCount = 0) {
  const { el, on, computed } = api;

  const { decrement, increment, reset, count, doubled } = createCounter(
    api,
    initialCount
  );
  const decrementBtn = el('button')('- Decrement');
  const incrementBtn = el('button')('+ Increment');
  const resetBtn = el('button')('Reset');

  // ============================================================================
  // IMPERATIVE: Behavior attachment (side effects via RefSpec chaining)
  // Note: api.on() returns a lifecycle callback, so we pass it directly
  // ============================================================================

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
}
