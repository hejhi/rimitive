import type { ReadableNode } from '@lattice/signals';

export type SignalValue<S> = S extends ReadableNode<infer T> ? T : never;

export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;
