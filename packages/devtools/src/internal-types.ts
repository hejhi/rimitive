/**
 * Internal type definitions for Lattice primitives
 *
 * These types match the actual internal structure of Lattice's implementation
 * and are used for dependency graph inspection and instrumentation.
 */

import type { Signal, Computed, Effect } from '@lattice/signals';
import { FLAGS } from './constants';

export interface DependencyNode {
  source: Signal<unknown> | Computed<unknown>;
  target: Computed<unknown> | Effect;
  prevSource?: DependencyNode;
  nextSource?: DependencyNode;
  prevTarget?: DependencyNode;
  nextTarget?: DependencyNode;
  version: number;
  rollbackNode?: DependencyNode;
}

export interface SignalImpl<T = unknown> extends Signal<T> {
  _value: T;
  _version: number;
  _targets?: DependencyNode;
  _node?: DependencyNode;
}

export interface ComputedImpl<T = unknown> extends Computed<T> {
  _fn: () => T;
  _value: T | undefined;
  _version: number;
  _globalVersion: number;
  _flags: number;
  _sources?: DependencyNode;
  _targets?: DependencyNode;
  _node?: DependencyNode;
}

export interface EffectImpl extends Effect {
  _fn: () => void | (() => void);
  _flags: number;
  _sources?: DependencyNode;
  _nextBatchedEffect?: Effect;
}

// Helper type to check if a primitive is disposed
export function isDisposed(impl: ComputedImpl | EffectImpl): boolean {
  return (impl._flags & FLAGS.DISPOSED) !== 0;
}

// Helper type to check if a computed is outdated
export function isOutdated(impl: ComputedImpl): boolean {
  return (impl._flags & FLAGS.OUTDATED) !== 0;
}
