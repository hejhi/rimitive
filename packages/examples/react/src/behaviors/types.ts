/**
 * Portable Behavior Types
 *
 * These types define the minimal signals API required by portable behaviors.
 * Any framework that provides these primitives can use these behaviors.
 *
 * This matches the pattern used in @lattice/headless.
 */
export type Signal<T> = {
  (): T;
  (value: T): void;
};

export type Computed<T> = () => T;

export interface SignalsApi {
  signal: <T>(initial: T) => Signal<T>;
  computed: <T>(fn: () => T) => Computed<T>;
  effect: (fn: () => void | (() => void)) => () => void;
}
