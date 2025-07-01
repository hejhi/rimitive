/**
 * @fileoverview Utilities for handling state updates
 *
 * This module contains shared logic for processing state updates,
 * including handling of derived signals, partial updates, and
 * collection operations.
 */

import type { Signal } from './types';
import { isDerivedSignal, type DerivedSignal } from '../core/signal';

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
 * Handles updates to derived signals that represent collection items
 */
export function handleDerivedSignalUpdate<T, Item>(
  signal: DerivedSignal<T, Item>,
  sourceValue: T,
  updates: Item | ((current: Item) => Item) | Partial<Item>
): { key: string; value: T } | null {
  // Ensure the derived signal has been evaluated to find its target
  const currentDerivedValue = signal();
  if (currentDerivedValue === undefined) {
    // Item not found, nothing to update
    return null;
  }

  // For arrays, update the specific item
  if (Array.isArray(sourceValue) && signal._cachedIndex !== undefined) {
    const newArray = [...sourceValue];
    const currentItem = newArray[signal._cachedIndex as number];

    if (currentItem !== undefined) {
      const newItem = applyUpdate(currentItem, updates);
      newArray[signal._cachedIndex as number] = newItem;
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
export function findSignalStateKey<State extends Record<string, any>>(
  signal: Signal<any>,
  stateSignals: Record<keyof State, Signal<State[keyof State]>>
): keyof State | undefined {
  for (const key in stateSignals) {
    if (stateSignals[key] === signal) {
      return key;
    }
    // Check if it's a derived signal from this state key
    if (isDerivedSignal(signal)) {
      const source = (signal as DerivedSignal<any, any>)._source;
      if (source === stateSignals[key]) {
        return key;
      }
    }
  }
  return undefined;
}
