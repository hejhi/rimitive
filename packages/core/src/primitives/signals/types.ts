// Shared types for signals implementation

export interface DependencyNode {
  source: Signal | Computed;
  target: Computed | Effect;
  prevSource?: DependencyNode;
  nextSource?: DependencyNode;
  prevTarget?: DependencyNode;
  nextTarget?: DependencyNode;
  version: number;
}

export interface Signal<T = unknown> {
  (): T;
  _value: T;
  _version: number;
  _targets?: DependencyNode;
}

export interface Computed<T = unknown> {
  (): T;
  _fn: () => T;
  _value?: T;
  _version: number;
  _globalVersion: number;
  _flags: number;
  _sources?: DependencyNode;
  _targets?: DependencyNode;
  _notify(): void;
  _recompute(): T;
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
}

// State flags
export const NOTIFIED = 1 << 0;
export const OUTDATED = 1 << 1;
export const RUNNING = 1 << 2;
export const DISPOSED = 1 << 3;
export const TRACKING = 1 << 4;  // Has active subscribers/targets
export const IS_COMPUTED = 1 << 5;  // Type discriminator for computed values
