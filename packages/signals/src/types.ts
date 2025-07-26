export interface BaseReactive {
  readonly __type: string;
}

// Node: The base interface for all reactive graph nodes
export interface Node<T = unknown> extends BaseReactive {
  value: T;
}

// Producer: A Node that produces values and can be observed
export interface Producer<T = unknown> extends Node<T> {
  _targets?: Edge;
  _version: number;
  _node?: Edge;
}

// Consumer: A node that observes other nodes
export interface Consumer extends BaseReactive {
  _sources?: Edge;
  _notify(): void;
  _flags: number;
}

// Edge: The connection between a Producer and Consumer in the dependency graph
export interface Edge {
  source: Producer;
  target: Consumer;
  prevSource?: Edge;
  nextSource?: Edge;
  prevTarget?: Edge;
  nextTarget?: Edge;
  version: number;
}

export interface Signal<T = unknown> extends Producer<T> {
  __type: 'signal';
  value: T;
  peek(): T;
  _value: T;
  // Object/array update methods
  set<K extends keyof T>(key: K, value: T[K]): void;
  patch<K extends keyof T>(
    key: K,
    partial: T[K] extends object ? Partial<T[K]> : never
  ): void;
}

export interface Computed<T = unknown> extends Producer<T>, Consumer {
  __type: 'computed';
  readonly value: T;
  peek(): T;
  _compute(): T;
  _value: T | undefined;
  _lastComputedAt: number;
  _recompute(): boolean;
  dispose(): void;
}

export interface Effect extends Consumer {
  __type: 'effect';
  _fn(): void;
  _nextBatchedEffect?: Effect;
  _run(): void;
  dispose(): void;
  subscribe?: (listener: () => void) => () => void;
}

// Additional type exports
export type EffectCleanup = void | (() => void);
export type Unsubscribe = () => void;

// Dispose function with attached effect instance
export interface EffectDisposer {
  (): void;
  __effect: Effect;
}

export interface ComputedOptions {
  equals?: (a: unknown, b: unknown) => boolean;
}

export interface SignalFactory {
  signal: <T>(initialValue: T) => Signal<T>;
  computed: <T>(fn: () => T, options?: ComputedOptions) => Computed<T>;
  effect: (fn: () => EffectCleanup) => Unsubscribe;
  batch: <T>(fn: () => T) => T;
  set: <T>(signal: Signal<T>, value: T) => void;
}
