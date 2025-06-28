/**
 * @fileoverview Set predicate module for smart updates
 * 
 * Provides functionality to find and update items in Sets using
 * predicate functions and value-based operations.
 */

export type SetPredicate<T> = (value: T) => boolean;
export type SetUpdate<T> = (value: T) => T;

/**
 * Finds items in a Set matching the predicate and applies the update function
 * Since Sets require unique values, this replaces matching items
 * @returns A new Set with updated items, or the original if no changes
 */
export function findAndUpdateSet<T>(
  set: Set<T>,
  predicate: SetPredicate<T>,
  update: SetUpdate<T>
): { updated: boolean; value: Set<T> } {
  let hasUpdates = false;
  const newSet = new Set<T>();
  
  for (const value of set) {
    if (predicate(value)) {
      const newValue = update(value);
      if (!Object.is(value, newValue)) {
        hasUpdates = true;
        newSet.add(newValue);
      } else {
        newSet.add(value);
      }
    } else {
      newSet.add(value);
    }
  }
  
  return { updated: hasUpdates, value: hasUpdates ? newSet : set };
}

/**
 * Finds the first item in a Set matching the predicate and applies the update function
 * @returns A new Set with the updated item, or the original if no match found
 */
export function findAndUpdateSetFirst<T>(
  set: Set<T>,
  predicate: SetPredicate<T>,
  update: SetUpdate<T>
): { updated: boolean; value: Set<T> } {
  for (const value of set) {
    if (predicate(value)) {
      const newValue = update(value);
      
      if (Object.is(value, newValue)) {
        return { updated: false, value: set };
      }
      
      const newSet = new Set<T>();
      let found = false;
      
      // Rebuild the set with the updated value
      for (const item of set) {
        if (!found && Object.is(item, value)) {
          newSet.add(newValue);
          found = true;
        } else {
          newSet.add(item);
        }
      }
      
      return { updated: true, value: newSet };
    }
  }
  
  return { updated: false, value: set };
}

/**
 * Adds an item to a Set if it doesn't already exist
 * @returns A new Set with the item added, or the original if it already exists
 */
export function addToSet<T>(
  set: Set<T>,
  value: T
): { updated: boolean; value: Set<T> } {
  if (set.has(value)) {
    return { updated: false, value: set };
  }
  
  const newSet = new Set(set);
  newSet.add(value);
  
  return { updated: true, value: newSet };
}

/**
 * Removes items from a Set that match the predicate
 * @returns A new Set without the matching items, or the original if no matches
 */
export function deleteFromSet<T>(
  set: Set<T>,
  predicate: SetPredicate<T>
): { updated: boolean; value: Set<T> } {
  const itemsToDelete: T[] = [];
  
  for (const value of set) {
    if (predicate(value)) {
      itemsToDelete.push(value);
    }
  }
  
  if (itemsToDelete.length === 0) {
    return { updated: false, value: set };
  }
  
  const newSet = new Set(set);
  for (const item of itemsToDelete) {
    newSet.delete(item);
  }
  
  return { updated: true, value: newSet };
}

/**
 * Toggles an item in a Set (adds if not present, removes if present)
 * @returns A new Set with the item toggled
 */
export function toggleInSet<T>(
  set: Set<T>,
  value: T
): { updated: boolean; value: Set<T> } {
  const newSet = new Set(set);
  
  if (newSet.has(value)) {
    newSet.delete(value);
  } else {
    newSet.add(value);
  }
  
  return { updated: true, value: newSet };
}

/**
 * Creates a predicate that matches Set values by equality
 */
export function setValue<T>(targetValue: T): SetPredicate<T> {
  return (value) => value === targetValue;
}

/**
 * Creates a predicate that matches Set values with specific property
 */
export function setValueHasProperty<T extends object, K extends keyof T>(
  key: K,
  value: T[K]
): SetPredicate<T> {
  return (setValue) => key in setValue && setValue[key] === value;
}