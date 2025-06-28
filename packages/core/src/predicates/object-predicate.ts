/**
 * @fileoverview Object predicate module for smart updates
 * 
 * Provides functionality to find and update properties in objects using
 * key-based lookups and predicate functions.
 */

export type ObjectPredicate<T> = (value: T, key: string) => boolean;
export type ObjectUpdate<T> = (value: T, key: string) => T;
export type KeyUpdate<T> = (value: T) => T;

/**
 * Updates a specific property in an object by key
 * @returns A new object with the updated property, or the original if unchanged
 */
export function findAndUpdateByKey<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  key: K,
  update: KeyUpdate<T[K]>
): { updated: boolean; value: T } {
  if (!(key in obj)) {
    return { updated: false, value: obj };
  }
  
  const oldValue = obj[key];
  const newValue = update(oldValue);
  
  if (Object.is(oldValue, newValue)) {
    return { updated: false, value: obj };
  }
  
  return { 
    updated: true, 
    value: { ...obj, [key]: newValue } 
  };
}

/**
 * Finds the first property in an object matching the predicate and applies the update function
 * @returns A new object with the updated property, or the original if no match found
 */
export function findAndUpdateByPredicate<T extends Record<string, any>>(
  obj: T,
  predicate: ObjectPredicate<T[keyof T]>,
  update: ObjectUpdate<T[keyof T]>
): { updated: boolean; value: T } {
  const entries = Object.entries(obj);
  
  for (const [key, val] of entries) {
    if (predicate(val, key)) {
      const newValue = update(val, key);
      
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
 * Creates an update function that replaces the entire value
 */
export function replaceValueUpdate<T>(newValue: T): ObjectUpdate<T> {
  return () => newValue;
}

/**
 * Creates an update function that merges properties into an object value
 */
export function mergeValueUpdate<T extends object>(
  updates: Partial<T>
): ObjectUpdate<T> {
  return (value) => ({ ...value, ...updates });
}