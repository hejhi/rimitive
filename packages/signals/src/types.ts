// Shared types for signals implementation

export interface DependencyNode {
  source: Signal | Computed;
  target: Computed | Effect;
  prevSource?: DependencyNode;
  nextSource?: DependencyNode;
  prevTarget?: DependencyNode;
  nextTarget?: DependencyNode;
  version: number;
  rollbackNode?: DependencyNode;
}

export interface Signal<T = unknown> {
  value: T;
  subscribe: (listener: () => void) => () => void;
  select: <R>(selector: (value: T) => R) => import('./select').Selected<R>;
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

export interface Computed<T = unknown> {
  readonly value: T;
  subscribe: (listener: () => void) => () => void;
  select: <R>(selector: (value: T) => R) => import('./select').Selected<R>;
  _fn: () => T;
  _value: T | undefined;
  _version: number;
  _globalVersion: number;
  _flags: number;
  _sources?: DependencyNode;
  _targets?: DependencyNode;
  _node?: DependencyNode; // For node reuse pattern
  _notify(): void;
  _refresh(): boolean;
  dispose(): void;
}

export interface Effect {
  _fn: () => void;
  _flags: number;
  _sources?: DependencyNode;
  _nextBatchedEffect?: Effect;
  _notify(): void;
  _run(): void;
  dispose(): void;
  subscribe?: (listener: () => void) => () => void;
}

// State flags
export const NOTIFIED = 1 << 0;
export const OUTDATED = 1 << 1;
export const RUNNING = 1 << 2;
export const DISPOSED = 1 << 3;
export const TRACKING = 1 << 4;  // Has active subscribers/targets
export const IS_COMPUTED = 1 << 5;  // Type discriminator for computed values

// Additional type exports
export type WritableSignal<T = unknown> = Signal<T>;
export type EffectCleanup = void | (() => void);
export type Unsubscribe = () => void;
export type Subscriber = () => void;

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
