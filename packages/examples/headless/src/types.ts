/**
 * Headless Component Types
 *
 * These types are equivalent to the centralized types in @lattice/signals/types.
 * We inline them here for now due to TypeScript module resolution complexities.
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
 * Minimal signals API required by headless components
 */
export type SignalsApi = {
  signal: <T>(initialValue: T) => Signal<T>;
  computed: <T>(fn: () => T) => Computed<T>;
  effect: (fn: () => void | (() => void)) => () => void;
};
