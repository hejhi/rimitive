// Context and shared types for signals implementation
// This module only exports types and factory functions, no global state

export const RUNNING = 1 << 2;
export const DISPOSED = 1 << 3;
export const OUTDATED = 1 << 1;
export const NOTIFIED = 1 << 0;
export const TRACKING = 1 << 4;
export const IS_COMPUTED = 1 << 5;

export interface SignalContext {
  currentComputed: ComputedInterface | EffectInterface | null;
  version: number;
  batchDepth: number;
  batchedEffects: EffectInterface | null;
  nodePool: DependencyNode[];
  poolSize: number;
  allocations: number;
  poolHits: number;
  poolMisses: number;
}

export interface DependencyNode {
  source: SignalInterface | ComputedInterface;
  target: ComputedInterface | EffectInterface;
  version: number;
  nextSource: DependencyNode | undefined;
  prevSource: DependencyNode | undefined;
  nextTarget: DependencyNode | undefined;
  prevTarget: DependencyNode | undefined;
}

export interface SignalInterface<T = unknown> {
  readonly __type: 'signal';
  value: T;
  _value: T;
  _version: number;
  _targets: DependencyNode | undefined;
  _node: DependencyNode | undefined;
  _refresh(): boolean;
  set(key: unknown, value: unknown): void;
  patch(key: unknown, partial: unknown): void;
  peek(): T;
}

export interface ComputedInterface<T = unknown> {
  readonly __type: 'computed';
  readonly value: T;
  _value: T | undefined;
  _version: number;
  _globalVersion: number;
  _flags: number;
  _sources: DependencyNode | undefined;
  _targets: DependencyNode | undefined;
  _node: DependencyNode | undefined;
  _compute: () => T;
  _refresh(): boolean;
  _notify(): void;
  dispose(): void;
  peek(): T;
}

export interface EffectInterface {
  readonly __type: 'effect';
  _flags: number;
  _sources: DependencyNode | undefined;
  _nextBatchedEffect: EffectInterface | undefined;
  _fn: () => void;
  _notify(): void;
  _run(): void;
  dispose(): void;
}

export interface EffectDisposerInterface {
  (): void;
  __effect?: EffectInterface;
}

// Constants
export const MAX_POOL_SIZE = 1000;
export const INITIAL_POOL_SIZE = 100;

// Factory to create a new context
export function createContext(): SignalContext {
  const nodePool = new Array(INITIAL_POOL_SIZE) as DependencyNode[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    nodePool[i] = {} as DependencyNode;
  }
  
  return {
    currentComputed: null,
    version: 0,
    batchDepth: 0,
    batchedEffects: null,
    nodePool,
    poolSize: INITIAL_POOL_SIZE,
    allocations: 0,
    poolHits: 0,
    poolMisses: 0,
  };
}

// Helper function used by all implementations
export function removeFromTargets(node: DependencyNode): void {
  const source = node.source;
  const prevTarget = node.prevTarget;
  const nextTarget = node.nextTarget;

  if (prevTarget !== undefined) {
    prevTarget.nextTarget = nextTarget;
  } else {
    source._targets = nextTarget;
    if (nextTarget === undefined && '_flags' in source) {
      source._flags &= ~TRACKING;
    }
  }

  if (nextTarget !== undefined) {
    nextTarget.prevTarget = prevTarget;
  }
}

// Export public types to match types.ts
export type Signal<T = unknown> = SignalInterface<T>;
export type Computed<T = unknown> = ComputedInterface<T>;
export type Effect = EffectInterface;
export type EffectDisposer = EffectDisposerInterface;