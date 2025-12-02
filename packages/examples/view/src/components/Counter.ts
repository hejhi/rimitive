import { el, t } from '../service';
import { useCounter } from '../behaviors/useCounter';

export const Counter = (initialCount: number = 0) => {
  const { decrement, increment, reset, count, doubled } =
    useCounter(initialCount);

  return el('div').props({ className: 'example' })(
    el('h2')('Counter Example'),
    el('p')('Demonstrates reactive text updates and event handlers.'),
    el('div').props({ className: 'counter-display' })(
      t`Count: ${count} (doubled: ${doubled})`
    ),
    el('div')(
      el('button').props({ onclick: decrement })('- Decrement'),
      el('button').props({ onclick: increment })('+ Increment'),
      el('button').props({ onclick: reset })('Reset')
    )
  );
};
