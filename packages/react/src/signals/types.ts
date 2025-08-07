import type { Readable } from '@lattice/signals/types';

export type SignalValue<S> = S extends Readable<infer T> ? T : never;

export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;
