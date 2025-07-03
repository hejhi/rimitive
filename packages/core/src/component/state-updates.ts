/**
 * @fileoverview Utilities for handling state updates
 *
 * This module contains shared logic for processing state updates,
 * including handling of signal selectors, partial updates, and
 * collection operations.
 */

import type { Signal, SignalSelector, SignalState } from './types';
import { isSignalSelector, getSourceSignal } from '../primitives/fast-signals/lattice-integration';

/**
 * Applies an update to a value, handling functions and partial object updates
 */
export function applyUpdate<T>(
  currentValue: T,
  updates: T | ((current: T) => T) | Partial<T>
): T {
  if (typeof updates === 'function') {
    return (updates as (current: T) => T)(currentValue);
  } else if (
    typeof updates === 'object' &&
    updates !== null &&
    typeof currentValue === 'object' &&
    currentValue !== null &&
    !Array.isArray(currentValue) &&
    !(currentValue instanceof Set) &&
    !(currentValue instanceof Map)
  ) {
    // Partial update for objects
    return { ...currentValue, ...updates } as T;
  } else {
    return updates as T;
  }
}

/**
 * Handles updates to signal selectors that represent collection items
 */
export function handleSignalSelectorUpdate<T, Item>(
  selector: SignalSelector<T, Item>,
  sourceValue: T,
  updates: Item | ((current: Item) => Item) | Partial<Item>
): { key: string; value: T } | null {
  // Ensure the selector has been evaluated to find its target
  const currentValue = selector();
  if (currentValue === undefined) {
    // Item not found, nothing to update
    return null;
  }

  // For arrays, update the specific item
  if (Array.isArray(sourceValue) && selector._cachedIndex !== undefined) {
    const newArray = [...sourceValue];
    const currentItem = newArray[selector._cachedIndex as number];

    if (currentItem !== undefined) {
      const newItem = applyUpdate(currentItem, updates);
      newArray[selector._cachedIndex as number] = newItem;
      return { key: '', value: newArray as T };
    }
  }

  // For other collection types (Maps, Sets, etc.), additional handling would go here
  // For now, return null to fall through to regular handling
  return null;
}

/**
 * Identifies which state key a signal belongs to
 */
export function findSignalStateKey<State>(
  signal: Signal<unknown> | SignalSelector<unknown, unknown>,
  stateSignals: SignalState<State>
): keyof State | undefined {
  for (const key in stateSignals) {
    if (stateSignals[key] === signal) return key;

    // Check if it's a selector from this state key
    if (
      isSignalSelector(signal) &&
      getSourceSignal(signal) === stateSignals[key]
    ) {
      return key;
    }
  }
  return undefined;
}
