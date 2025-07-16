/**
 * Utilities for extracting dependency information from Lattice primitives
 *
 * This module provides access to the internal dependency graph maintained
 * by Lattice's reactive system.
 */

import type { Signal, Computed, Effect } from '@lattice/core';
import type { SignalImpl, ComputedImpl, EffectImpl } from './internal-types';
import { isDisposed } from './internal-types';
import { isSignal, isComputed } from './type-guards';

export interface DependencyInfo {
  id: string;
  type: 'signal' | 'computed' | 'effect';
  name?: string;
  value?: unknown;
  isActive?: boolean;
  ref?: Signal<unknown> | Computed<unknown> | Effect;
}

/**
 * Get all subscribers (effects/computeds) that depend on a signal/computed
 */
export function getSubscribers(
  source: Signal<unknown> | Computed<unknown>
): DependencyInfo[] {
  const subscribers: DependencyInfo[] = [];
  const impl = source as SignalImpl | ComputedImpl;

  let node = impl._targets;
  while (node) {
    const target = node.target;
    const targetImpl = target as ComputedImpl | EffectImpl;

    subscribers.push({
      id: getReactiveId(target),
      type: isComputed(target) ? 'computed' : 'effect',
      name: getReactiveName(target),
      isActive: !isDisposed(targetImpl),
      ref: target,
    });

    node = node.nextTarget;
  }

  return subscribers;
}

/**
 * Get all dependencies (signals/computeds) that an effect/computed depends on
 */
export function getDependencies(
  target: Computed<unknown> | Effect
): DependencyInfo[] {
  const dependencies: DependencyInfo[] = [];
  const impl = target as ComputedImpl | EffectImpl;

  let node = impl._sources;
  while (node) {
    const source = node.source;

    dependencies.push({
      id: getReactiveId(source),
      type: isSignal(source) ? 'signal' : 'computed',
      name: getReactiveName(source),
      value: getCurrentValue(source),
      ref: source,
    });

    node = node.nextSource;
  }

  return dependencies;
}

/**
 * Get the current value of a signal or computed (without triggering dependencies)
 */
export function getCurrentValue(
  source: Signal<unknown> | Computed<unknown>
): unknown {
  const impl = source as SignalImpl | ComputedImpl;
  return impl._value;
}

// WeakMap to store consistent IDs for reactive primitives
const reactiveIds = new WeakMap<object, string>();
let idCounter = 0;

/**
 * Get or generate a consistent ID for a reactive primitive
 */
function getReactiveId(
  reactive: Signal<unknown> | Computed<unknown> | Effect
): string {
  let id = reactiveIds.get(reactive);
  if (!id) {
    const type = isSignal(reactive)
      ? 'sig'
      : isComputed(reactive)
        ? 'comp'
        : 'eff';
    id = `${type}_${++idCounter}`;
    reactiveIds.set(reactive, id);
  }
  return id;
}

/**
 * Extract the name of a reactive primitive if it was provided
 */
function getReactiveName(
  reactive: Signal<unknown> | Computed<unknown> | Effect
): string | undefined {
  // Direct name property
  if ('_name' in reactive && typeof reactive._name === 'string') {
    return reactive._name;
  }

  // Name might be stored in metadata
  if (
    '_meta' in reactive &&
    reactive._meta &&
    typeof reactive._meta === 'object' &&
    'name' in reactive._meta &&
    typeof reactive._meta.name === 'string'
  ) {
    return reactive._meta.name;
  }

  // For store signals, the name might be the property key
  if ('_key' in reactive && typeof reactive._key === 'string') {
    return reactive._key;
  }

  return undefined;
}