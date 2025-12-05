/**
 * Behavior binding helper
 *
 * Binds a portable behavior to a reactive service.
 * Behaviors are curried functions: (svc) => (...args) => Result
 */

import type { Readable, Writable } from '@lattice/signals/types';

/**
 * Creates a `use` helper bound to a specific reactive service.
 */
export const createUse = <
  TSvc extends {
    signal: <T>(initialValue: T) => Writable<T>;
    computed: <T>(fn: () => T) => Readable<T>;
    effect: (fn: () => void | (() => void)) => () => void;
    batch: <T>(fn: () => T) => T;
  },
>(
  svc: TSvc
) => {
  return <Args extends unknown[], Result>(
    behavior: (svc: TSvc) => (...args: Args) => Result
  ): ((...args: Args) => Result) => {
    return behavior(svc);
  };
};
