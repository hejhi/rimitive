import type { SignalLike } from '@lattice/signals';

export type SignalValue<S> = S extends SignalLike<infer T> ? T : never;

export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;
