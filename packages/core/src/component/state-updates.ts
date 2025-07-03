/**
 * @fileoverview Utilities for handling state updates
 *
 * This module contains shared logic for processing state updates,
 * including partial updates and collection operations.
 */

// No imports needed for this utility module

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

