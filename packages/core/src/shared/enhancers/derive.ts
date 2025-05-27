import type { Enhancer, EnhancerContext } from '../enhancers';

/**
 * Memoization cache for derived values
 */
const memoCache = new WeakMap<Function, Map<string, any>>();

/**
 * Derive enhancer - creates computed/derived values with automatic memoization
 */
export const derive: Enhancer<
  'derive',
  <T, R>(selector: () => T, transform: (value: T) => R) => R
> = {
  name: 'derive' as const,
  create: (_context: EnhancerContext) => {
    return <T, R>(selector: () => T, transform: (value: T) => R): R => {
      // Get or create cache for this transform function
      if (!memoCache.has(transform)) {
        memoCache.set(transform, new Map());
      }
      const cache = memoCache.get(transform)!;
      
      // Get the selector value
      const value = selector();
      
      // Create a cache key based on the value
      // For simplicity, we'll use JSON.stringify for primitive values
      // In production, you'd want a more robust cache key strategy
      const cacheKey = JSON.stringify(value);
      
      // Check if we have a cached result
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }
      
      // Compute and cache the result
      const result = transform(value);
      cache.set(cacheKey, result);
      
      return result;
    };
  },
};