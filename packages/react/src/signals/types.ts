import type { Signal, Computed } from '@lattice/signals';

export type SignalLike<T> = Signal<T> | Computed<T>;

export type SignalValue<S> = S extends SignalLike<infer T> ? T : never;

export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;
