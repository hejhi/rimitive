// Node: The base interface for all reactive graph nodes
export interface Node<T = unknown> {
  value: T;
  readonly __type: string;
}

// Producer: A Node that produces values and can be observed
export interface Producer<T = unknown> extends Node<T> {
  _targets?: Edge;
  _version: number;
  _node?: Edge; // For edge reuse pattern
}

// Consumer: A node that observes other nodes
export interface Consumer {
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
  rollbackNode?: Edge;
}

export interface Signal<T = unknown> extends Producer<T> {
  value: T;
  peek(): T;
  __type: 'signal';
  _value: T;
  _version: number;
  _targets?: Edge;
  _node?: Edge; // For edge reuse pattern
  // Object/array update methods
  set<K extends keyof T>(key: K, value: T[K]): void;
  patch<K extends keyof T>(
    key: K,
    partial: T[K] extends object ? Partial<T[K]> : never
  ): void;
}

export interface Computed<T = unknown> extends Producer<T> {
  readonly value: T;
  peek: () => T;
  __type: 'computed';
  _compute: () => T;
  _value: T | undefined;
  _version: number;
  _lastComputedAt: number;
  _flags: number;
  _sources?: Edge;
  _targets?: Edge;
  _node?: Edge; // For edge reuse pattern
  _notify(): void;
  _recompute(): boolean;
  dispose(): void;
}

export interface Effect {
  __type: 'effect';
  _fn: () => void;
  _flags: number;
  _sources?: Edge;
  _nextBatchedEffect?: Effect;
  _notify(): void;
  _run(): void;
  dispose(): void;
  subscribe?: (listener: () => void) => () => void;
}

// ProducerNode and ConsumerNode are legacy names, now use Producer and Consumer
export interface ProducerNode extends Producer {}
export interface ConsumerNode extends Consumer {}

// Additional type exports
export type WritableSignal<T = unknown> = Signal<T>;
export type EffectCleanup = void | (() => void);
export type Unsubscribe = () => void;
export type Subscriber = () => void;


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
