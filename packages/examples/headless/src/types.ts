import type { Writable, Readable } from '@lattice/signals/types';

export type ReactiveSvc = {
  signal: <T>(initialValue: T) => Writable<T>;
  computed: <T>(fn: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
};
