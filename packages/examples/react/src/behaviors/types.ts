/**
 * Portable Behavior Types
 *
 * These types are equivalent to the centralized types in @lattice/signals/types.
 * We inline them here for now due to TypeScript module resolution complexities.
 */

export type Signal<T> = {
  (): T;
  (value: T): void;
};

export type Computed<T> = () => T;

export type SignalsApi = {
  signal: <T>(initialValue: T) => Signal<T>;
  computed: <T>(fn: () => T) => Computed<T>;
  effect: (fn: () => void | (() => void)) => () => void;
};
