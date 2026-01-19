/**
 * Counter View Component
 */
import type { Service } from '../service';

type CounterProps = {
  count: () => number;
  doubled: () => number;
  isEven: () => boolean;
  set: (value: number) => void;
};

export const Counter =
  (svc: Service) =>
  ({ count, doubled, isEven, set }: CounterProps) => {
    const { el, computed } = svc;

    return el('section').props({ className: 'counter-section' })(
      el('h2')('Counter Example'),
      el('div').props({ className: 'counter-display' })(
        el('p')(computed(() => `Count: ${count()}`)),
        el('p')(computed(() => `Doubled: ${doubled()}`)),
        el('p')(computed(() => `Is Even: ${isEven() ? 'Yes' : 'No'}`))
      ),
      el('div').props({ className: 'counter-controls' })(
        el('button').props({ onclick: () => set(count() + 1) })('Increment'),
        el('button').props({ onclick: () => set(count() - 1) })('Decrement'),
        el('button').props({ onclick: () => set(0) })('Reset')
      )
    );
  };
