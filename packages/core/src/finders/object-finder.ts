/**
 * @fileoverview Object finder module for smart updates
 * 
 * Provides functionality to find and update properties in objects using
 * key-based lookups and predicate functions.
 */

export type ObjectPredicate<T> = (value: T, key: string) => boolean;
export type ObjectUpdater<T> = (value: T, key: string) => T;
export type KeyUpdater<T> = (value: T) => T;

/**
 * Updates a specific property in an object by key
 * @returns A new object with the updated property, or the original if unchanged
 */
export function findAndUpdateByKey<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  key: K,
  updater: KeyUpdater<T[K]>
): { updated: boolean; value: T } {
  if (!(key in obj)) {
    return { updated: false, value: obj };
  }
  
  const oldValue = obj[key];
  const newValue = updater(oldValue);
  
  if (Object.is(oldValue, newValue)) {
    return { updated: false, value: obj };
  }
  
  return { 
    updated: true, 
    value: { ...obj, [key]: newValue } 
  };
}

/**
 * Finds the first property in an object matching the predicate and applies the updater
 * @returns A new object with the updated property, or the original if no match found
 */
export function findAndUpdateByPredicate<T extends Record<string, any>>(
  obj: T,
  finder: ObjectPredicate<T[keyof T]>,
  updater: ObjectUpdater<T[keyof T]>
): { updated: boolean; value: T } {
  const entries = Object.entries(obj);
  
  for (const [key, val] of entries) {
    if (finder(val, key)) {
      const newValue = updater(val, key);
      
      if (Object.is(val, newValue)) {
        return { updated: false, value: obj };
      }
      
      return { 
        updated: true, 
        value: { ...obj, [key]: newValue } 
      };
    }
  }
  
  return { updated: false, value: obj };
}

/**
 * Creates a predicate that matches properties by value
 */
export function valuePredicate<T>(targetValue: T): ObjectPredicate<T> {
  return (value) => value === targetValue;
}

/**
 * Creates a predicate that matches properties with specific nested values
 */
export function nestedValuePredicate<T extends object, K extends keyof T>(
  nestedKey: K,
  targetValue: T[K]
): ObjectPredicate<T> {
  return (value) => {
    return typeof value === 'object' && 
           value !== null && 
           nestedKey in value && 
           (value as T)[nestedKey] === targetValue;
  };
}

/**
 * Creates an updater that replaces the entire value
 */
export function replaceValueUpdater<T>(newValue: T): ObjectUpdater<T> {
  return () => newValue;
}

/**
 * Creates an updater that merges properties into an object value
 */
export function mergeValueUpdater<T extends object>(
  updates: Partial<T>
): ObjectUpdater<T> {
  return (value) => ({ ...value, ...updates });
}