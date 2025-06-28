/**
 * @fileoverview Map predicate module for smart updates
 * 
 * Provides functionality to find and update entries in Maps using
 * key-based lookups and predicate functions.
 */

export type MapKeyPredicate<K> = (key: K) => boolean;
export type MapValuePredicate<V> = (value: V, key: any) => boolean;
export type MapEntryPredicate<K, V> = (value: V, key: K) => boolean;
export type MapValueUpdate<V> = (value: V, key: any) => V;

/**
 * Updates a specific entry in a Map by key
 * @returns A new Map with the updated entry, or the original if unchanged
 */
export function findAndUpdateMapByKey<K, V>(
  map: Map<K, V>,
  key: K,
  update: (value: V) => V
): { updated: boolean; value: Map<K, V> } {
  if (!map.has(key)) {
    return { updated: false, value: map };
  }
  
  const oldValue = map.get(key)!;
  const newValue = update(oldValue);
  
  if (Object.is(oldValue, newValue)) {
    return { updated: false, value: map };
  }
  
  const newMap = new Map(map);
  newMap.set(key, newValue);
  
  return { updated: true, value: newMap };
}

/**
 * Finds entries in a Map where keys match the predicate and applies the update function
 * @returns A new Map with updated entries, or the original if no changes
 */
export function findAndUpdateMapByKeyPredicate<K, V>(
  map: Map<K, V>,
  predicate: MapKeyPredicate<K>,
  update: MapValueUpdate<V>
): { updated: boolean; value: Map<K, V> } {
  let hasUpdates = false;
  const newMap = new Map<K, V>();
  
  for (const [key, value] of map) {
    if (predicate(key)) {
      const newValue = update(value, key);
      if (!Object.is(value, newValue)) {
        hasUpdates = true;
        newMap.set(key, newValue);
      } else {
        newMap.set(key, value);
      }
    } else {
      newMap.set(key, value);
    }
  }
  
  return { updated: hasUpdates, value: hasUpdates ? newMap : map };
}

/**
 * Finds the first entry in a Map where the value matches the predicate and applies the update function
 * @returns A new Map with the updated entry, or the original if no match found
 */
export function findAndUpdateMapByValuePredicate<K, V>(
  map: Map<K, V>,
  predicate: MapValuePredicate<V>,
  update: MapValueUpdate<V>
): { updated: boolean; value: Map<K, V> } {
  for (const [key, value] of map) {
    if (predicate(value, key)) {
      const newValue = update(value, key);
      
      if (Object.is(value, newValue)) {
        return { updated: false, value: map };
      }
      
      const newMap = new Map(map);
      newMap.set(key, newValue);
      
      return { updated: true, value: newMap };
    }
  }
  
  return { updated: false, value: map };
}

/**
 * Deletes entries from a Map where keys match the predicate
 * @returns A new Map without the matching entries, or the original if no matches
 */
export function deleteMapByKeyPredicate<K, V>(
  map: Map<K, V>,
  predicate: MapKeyPredicate<K>
): { updated: boolean; value: Map<K, V> } {
  const keysToDelete: K[] = [];
  
  for (const key of map.keys()) {
    if (predicate(key)) {
      keysToDelete.push(key);
    }
  }
  
  if (keysToDelete.length === 0) {
    return { updated: false, value: map };
  }
  
  const newMap = new Map(map);
  for (const key of keysToDelete) {
    newMap.delete(key);
  }
  
  return { updated: true, value: newMap };
}

/**
 * Creates a predicate that matches Map values by equality
 */
export function mapValueEquals<V>(targetValue: V): MapValuePredicate<V> {
  return (value) => value === targetValue;
}

/**
 * Creates a predicate that matches Map values with specific property
 */
export function mapValueHasProperty<V extends object, K extends keyof V>(
  key: K,
  value: V[K]
): MapValuePredicate<V> {
  return (mapValue) => key in mapValue && mapValue[key] === value;
}