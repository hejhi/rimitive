import { Service } from './svc.ts';

// Track the previous value for transitions/undo
export const withPrevious =
  ({ signal, computed }: Pick<Service, 'signal' | 'computed'>) =>
  <T>(initial: T) => {
    const current = signal(initial);
    const previous = signal(initial);

    const set = (value: T) => {
      previous(current());
      current(value);
    };

    const changed = computed(() => current() !== previous());

    return { current, previous, set, changed };
  };
