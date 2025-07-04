// Shared types for signals implementation

export interface DependencyNode {
  _source: Signal | Computed;
  _target: Computed | Effect;
  _prevSource: DependencyNode | undefined;
  _nextSource: DependencyNode | undefined;
  _prevTarget: DependencyNode | undefined;
  _nextTarget: DependencyNode | undefined;
  _version: number;
  _rollbackNode: DependencyNode | undefined;
}

export interface Signal<T = unknown> {
  value: T;  // Now read/write
  subscribe?: (listener: () => void) => () => void;
  _value: T;
  _version: number;
  _targets: DependencyNode | undefined;
  _targetsTail: DependencyNode | undefined;
  _scope: any; // Reference to SignalScope
  _batch: any; // Reference to BatchScope
  _node: any;  // Reference to NodeScope
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
  _sources: DependencyNode | undefined;
  _sourcesTail: DependencyNode | undefined;
  _targets: DependencyNode | undefined;
  _targetsTail: DependencyNode | undefined;
  _notify(): void;
  _refresh(): T | boolean;
  _needsToRecompute(): boolean;
  _prepareSources(): void;
  _cleanupSources(): void;
  dispose(): void;
  _scope: any; // Reference to SignalScope
  _node: any;  // Reference to NodeScope
}

export interface Effect {
  _fn: () => void;
  _flags: number;
  _sources: DependencyNode | undefined;
  _sourcesTail: DependencyNode | undefined;
  _nextBatchedEffect: Effect | undefined;
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
