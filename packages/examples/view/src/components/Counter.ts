import { el, t } from '../service';
import { useCounter } from '../behaviors/useCounter';

export const Counter = (initialCount: number = 0) => {
  const { decrement, increment, reset, count, doubled } =
    useCounter(initialCount);

  return el('div', { className: 'example' })(
    el('h2')('Counter Example'),
    el('p')('Demonstrates reactive text updates and event handlers.'),
    el('div', { className: 'counter-display' })(
      t`Count: ${count} (doubled: ${doubled})`
    ),
    el('div')(
      el('button', { onclick: decrement })('- Decrement'),
      el('button', { onclick: increment })('+ Increment'),
      el('button', { onclick: reset })('Reset')
    )
  );
};
