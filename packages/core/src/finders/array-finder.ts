/**
 * @fileoverview Array finder module for smart updates
 * 
 * Provides functionality to find and update items in arrays using
 * predicate functions and index-based lookups.
 */

export type ArrayPredicate<T> = (item: T, index: number) => boolean;
export type ArrayUpdater<T> = (item: T, index: number) => T;

/**
 * Finds the first item in an array matching the predicate and applies the updater
 * @returns A new array with the updated item, or the original array if no match found
 */
export function findAndUpdateArray<T>(
  array: T[],
  finder: ArrayPredicate<T>,
  updater: ArrayUpdater<T>
): { updated: boolean; value: T[] } {
  const index = array.findIndex((item, idx) => finder(item, idx));
  
  if (index === -1) {
    return { updated: false, value: array };
  }
  
  const oldItem = array[index]!;
  const newItem = updater(oldItem, index);
  
  // Only create new array if item actually changed
  if (Object.is(oldItem, newItem)) {
    return { updated: false, value: array };
  }
  
  const newArray = [...array];
  newArray[index] = newItem;
  
  return { updated: true, value: newArray };
}

/**
 * Creates a predicate that matches items by index
 */
export function indexPredicate<T>(targetIndex: number): ArrayPredicate<T> {
  return (_, index) => index === targetIndex;
}

/**
 * Creates a predicate that matches items by property value
 */
export function propertyPredicate<T, K extends keyof T>(
  key: K,
  value: T[K]
): ArrayPredicate<T> {
  return (item) => item[key] === value;
}

/**
 * Creates an updater that replaces the entire item
 */
export function replaceUpdater<T>(newItem: T): ArrayUpdater<T> {
  return () => newItem;
}

/**
 * Creates an updater that merges properties into an object item
 */
export function mergeUpdater<T extends object>(
  updates: Partial<T>
): ArrayUpdater<T> {
  return (item) => ({ ...item, ...updates });
}