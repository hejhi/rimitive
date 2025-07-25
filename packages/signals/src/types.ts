// Shared types for signals implementation

export interface ReactiveNode {
  _targets?: DependencyNode;
  _version: number;
  _refresh(): boolean;
  _node?: DependencyNode; // For node reuse pattern
}

export interface ConsumerNode {
  _sources?: DependencyNode;
  _notify(): void;
  _flags: number;
}

export interface DependencyNode {
  source: ReactiveNode;
  target: ConsumerNode;
  prevSource?: DependencyNode;
  nextSource?: DependencyNode;
  prevTarget?: DependencyNode;
  nextTarget?: DependencyNode;
  version: number;
  rollbackNode?: DependencyNode;
}

export interface Signal<T = unknown> extends Subscribable {
  value: T;
  peek(): T;
  __type: 'signal';
  _value: T;
  _version: number;
  _targets?: DependencyNode;
  _node?: DependencyNode; // For node reuse pattern
  _refresh(): boolean;
  // Object/array update methods
  set<K extends keyof T>(key: K, value: T[K]): void;
  patch<K extends keyof T>(
    key: K,
    partial: T[K] extends object ? Partial<T[K]> : never
  ): void;
}

export interface Computed<T = unknown> extends Subscribable {
  readonly value: T;
  peek: () => T;
  __type: 'computed';
  _compute: () => T;
  _value: T | undefined;
  _version: number;
  _lastComputedAt: number;
  _flags: number;
  _sources?: DependencyNode;
  _targets?: DependencyNode;
  _node?: DependencyNode; // For node reuse pattern
  _notify(): void;
  _refresh(): boolean;
  dispose(): void;
}

export interface Effect {
  __type: 'effect';
  _fn: () => void;
  _flags: number;
  _sources?: DependencyNode;
  _nextBatchedEffect?: Effect;
  _notify(): void;
  _run(): void;
  dispose(): void;
  subscribe?: (listener: () => void) => () => void;
}

// Minimal interface for values that can be subscribed to
export type Subscribable<T = unknown> = {
  value: T;
  readonly __type: string;
};

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
