/**
 * Type definitions for framework-agnostic behaviors
 *
 * Minimal interfaces for signals-based reactive primitives
 */

/**
 * Signal function with both getter and setter
 */
export interface SignalFunction<T> {
  (): T; // Read operation
  (value: T): void; // Write operation
  peek(): T; // Non-tracking read
}

/**
 * Computed function (read-only)
 */
export interface ComputedFunction<T> {
  (): T; // Read operation
  peek(): T; // Non-tracking read
}

/**
 * Minimal signals API for headless behaviors
 *
 * Behaviors that only need reactive primitives should depend on this interface.
 * This makes them reusable with any signals implementation
 * (Lattice, Solid, Preact Signals, etc.)
 */
export interface SignalsAPI {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;
}
