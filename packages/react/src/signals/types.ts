import type { Readable } from '@rimitive/signals/types';

/**
 * Extract the value type from a Readable signal.
 *
 * @example
 * ```tsx
 * type MySignal = Readable<number>;
 * type Value = SignalValue<MySignal>; // number
 * ```
 */
export type SignalValue<S> = S extends Readable<infer T> ? T : never;

/**
 * A setter function for updating signal values.
 * Accepts either a new value or an updater function.
 *
 * @example
 * ```tsx
 * const setter: SignalSetter<number> = (value) => {
 *   // value can be a number or a function (prev: number) => number
 * };
 *
 * setter(5); // Direct value
 * setter(prev => prev + 1); // Updater function
 * ```
 */
export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;
