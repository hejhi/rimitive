import { Service } from './svc.ts';

// Toggle pattern: boolean signal with on/off/toggle methods
export const toggle =
  ({ signal }: Pick<Service, 'signal'>) =>
  (initial = false) => {
    const value = signal(initial);

    return Object.assign(value, {
      on: () => value(true),
      off: () => value(false),
      toggle: () => value(!value()),
    });
  };
