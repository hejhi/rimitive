import type { Node } from '@lattice/signals';

export type SignalValue<S> = S extends Node<infer T> ? T : never;

export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;
