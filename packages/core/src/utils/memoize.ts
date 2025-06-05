/**
 * @fileoverview Memoization utilities for view functions
 *
 * Provides memory-safe caching for parameterized views using WeakMap
 * for object arguments and limited Map for primitive arguments.
 */

/**
 * Creates a memory-safe memoized version of a parameterized view function.
 * Uses WeakMap for object parameters and limited Map for primitives.
 * 
 * @param view The view function to memoize
 * @param maxPrimitiveCache Maximum number of primitive argument combinations to cache
 * @returns Memoized version of the view function
 */
export function memoizeParameterizedView<T extends (...args: any[]) => any>(
  view: T,
  maxPrimitiveCache = 50
): T {
  // For views with object parameters (most common case)
  const objectCache = new WeakMap<object, any>();
  
  // For primitive parameters (fallback)
  const primitiveCache = new Map<string, any>();
  
  return ((...args: Parameters<T>) => {
    // Fast path: single object parameter
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      if (!objectCache.has(args[0])) {
        objectCache.set(args[0], view(...args));
      }
      return objectCache.get(args[0]);
    }
    
    // Primitive arguments: use limited Map
    if (args.every(arg => arg == null || typeof arg !== 'object')) {
      const key = args.join('\x1F'); // Unit separator character
      
      if (!primitiveCache.has(key)) {
        if (primitiveCache.size >= maxPrimitiveCache) {
          // LRU: delete first (oldest) entry
          const firstKey = primitiveCache.keys().next().value;
          if (firstKey !== undefined) {
            primitiveCache.delete(firstKey);
          }
        }
        primitiveCache.set(key, view(...args));
      }
      
      return primitiveCache.get(key);
    }
    
    // Mixed or complex args: no caching
    return view(...args);
  }) as T;
}

/**
 * Options for configuring memoization behavior
 */
export interface MemoizeOptions {
  /** Maximum number of cached results for primitive parameters */
  maxPrimitiveCache?: number;
}