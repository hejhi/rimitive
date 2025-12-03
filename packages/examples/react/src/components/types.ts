/**
 * Portable Behavior Types
 *
 * These types define the minimal signals API required by portable behaviors.
 * Any framework that provides these primitives can use these behaviors.
 *
 * This matches the pattern used in @lattice/headless.
 */

/**
 * A reactive value that can be read (called with no args) or written (called with a value)
 */
export type Signal<T> = {
  (): T;
  (value: T): void;
};

/**
 * A derived reactive value (read-only)
 */
export type Computed<T> = () => T;

/**
 * Minimal signals API required by portable behaviors
 */
export interface SignalsApi {
  signal: <T>(initial: T) => Signal<T>;
  computed: <T>(fn: () => T) => Computed<T>;
  effect: (fn: () => void | (() => void)) => () => void;
}
