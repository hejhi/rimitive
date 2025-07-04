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
  subscribe?: (listener: () => void) => () => void;
  _value: T;
  _version: number;
  _targets?: DependencyNode;
  _node?: DependencyNode; // For node reuse pattern
  _scope: unknown; // Single unified scope
  _refresh(): boolean;
}

export interface Computed<T = unknown> {
  readonly value: T;
  subscribe?: (listener: () => void) => () => void;
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
  _scope: unknown; // Single unified scope
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
