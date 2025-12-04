/**
 * Type definitions for the Lattice API with Signals + View
 *
 * These types are equivalent to the centralized types in @lattice/signals/types.
 * We inline them here for now due to TypeScript module resolution complexities.
 */

/**
 * Signal function with both getter and setter
 * Note: For portable behaviors, use the Writable<T> type from @lattice/signals/types instead.
 * This extended interface is specific to implementations that provide peek().
 */
export interface SignalFunction<T> {
  (): T; // Read operation
  (value: T): void; // Write operation
  peek(): T; // Non-tracking read
}

/**
 * Computed function (read-only)
 * Note: For portable behaviors, use the Readable<T> type from @lattice/signals/types instead.
 * This extended interface is specific to implementations that provide peek().
 */
export interface ComputedFunction<T> {
  (): T; // Read operation
  peek(): T; // Non-tracking read
}

/**
 * Minimal signals API for headless behaviors
 *
 * Behaviors that only need reactive primitives should depend on this interface,
 * not on LatticeViewAPI. This makes them reusable with any signals implementation
 * (Lattice, Solid, Preact Signals, etc.)
 */
export interface SignalsAPI {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;
}
