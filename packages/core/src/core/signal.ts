/**
 * @fileoverview Signal implementation for reactive state management
 *
 * Provides read-only signals that can create signal selectors with predicates.
 * All updates must go through the set() function.
 */

import type { Signal, SignalSelector } from '../component/types';
import type { TrackingContext } from './tracking';
import type { BatchingSystem } from './batching';

/**
 * Valid cache key types for collections
 */
type CacheKey = number | string | symbol;

/**
 * Base signal with version tracking for cache invalidation
 */
interface BaseSignal<T> extends Signal<T> {
  _value: T;
  _version: number;
  _listeners: Set<() => void>;
}

/**
 * Creates a signal factory bound to the given tracking and batching contexts
 */
export function createSignalFactory(
  tracking: TrackingContext,
  batching: BatchingSystem
) {
  // WeakMap to store keyed signal selector caches
  // The key is the signal instance itself (type parameter doesn't matter for identity)
  const keyedSignalSelectorCaches = new WeakMap<
    BaseSignal<unknown>,
    Map<(key: unknown) => unknown, Map<unknown, WeakRef<SignalSelector<unknown, unknown>>>>
  >();

  // Registry to track cleanup functions for automatic garbage collection
  // This prevents memory leaks by ensuring dead WeakRefs are cleaned up
  // even if the key is never requested again
  const cleanupRegistry = new FinalizationRegistry<{
    signalCache: Map<(key: unknown) => unknown, Map<unknown, WeakRef<SignalSelector<unknown, unknown>>>>;
    keyFn: (key: unknown) => unknown;
    key: unknown;
  }>((heldValue) => {
    // When a selector is garbage collected, clean up its WeakRef entry
    const keyCache = heldValue.signalCache.get(heldValue.keyFn);
    if (keyCache) {
      keyCache.delete(heldValue.key);
      // If the keyCache is now empty, remove it
      if (keyCache.size === 0) {
        heldValue.signalCache.delete(heldValue.keyFn);
      }
    }
  });

  /**
   * Creates a read-only signal within this context
   */
  return function signal<T>(initialValue: T): Signal<T> {
    const baseSignal = function (this: unknown, ...args: unknown[]) {
      // Read operation
      if (arguments.length === 0) {
        tracking.track(baseSignal);
        return baseSignal._value;
      }

      // Single predicate - create signal selector
      if (arguments.length === 1 && typeof args[0] === 'function') {
        return createSelector(
          baseSignal,
          args[0] as (value: unknown, key?: CacheKey) => boolean,
          tracking,
          batching
        );
      }

      // Keyed signal selector - keyFn and predicate
      if (
        arguments.length === 2 &&
        typeof args[0] === 'function' &&
        typeof args[1] === 'function'
      ) {
        const keyFn = args[0] as (key: unknown) => unknown;
        const predicate = args[1] as (value: unknown, key?: CacheKey) => boolean;

        // Get or create cache for this signal
        const signalKey = baseSignal as BaseSignal<unknown>;
        if (!keyedSignalSelectorCaches.has(signalKey)) {
          keyedSignalSelectorCaches.set(signalKey, new Map());
        }

        const signalCache = keyedSignalSelectorCaches.get(signalKey)!;

        // Get or create cache for this keyFn
        if (!signalCache.has(keyFn)) {
          const keyedCache = new Map<
            unknown,
            WeakRef<SignalSelector<unknown, unknown>>
          >();
          signalCache.set(keyFn, keyedCache);
        }

        const keyCache = signalCache.get(keyFn);

        // Return function that creates/returns cached signal selectors
        return (key: unknown) => {
          const ref = keyCache?.get(key);
          const existingSignal = ref?.deref();

          // WeakRef is dead, remove it
          if (ref && !existingSignal) {
            keyCache?.delete(key);
          } else if (existingSignal) {
            return existingSignal;
          }

          // Create new signal selector
          const selector = createSelector(
            baseSignal,
            (item: unknown) => predicate(item, key as CacheKey),
            tracking,
            batching
          );
          
          // Create WeakRef and register for cleanup
          const weakRef = new WeakRef(selector as SignalSelector<unknown, unknown>);
          keyCache?.set(key, weakRef);
          
          // Register the selector with FinalizationRegistry for automatic cleanup
          cleanupRegistry.register(selector, {
            signalCache: signalCache,
            keyFn: keyFn,
            key: key
          });
          
          return selector;
        };
      }

      throw new Error(
        'Invalid signal operation. Signals are read-only. Use set() to update.'
      );
    } as BaseSignal<T>;

    // Initialize signal properties
    baseSignal._value = initialValue;
    baseSignal._version = 0;
    baseSignal._listeners = new Set<() => void>();

    baseSignal.subscribe = (listener: () => void) => {
      baseSignal._listeners.add(listener);
      return () => baseSignal._listeners.delete(listener);
    };

    return baseSignal;
  };
}

/**
 * Creates a selector that queries items from a collection signal
 */
function createSelector<T, U>(
  source: BaseSignal<T>,
  predicate: (value: unknown, key?: CacheKey) => boolean,
  tracking: TrackingContext,
  batching: BatchingSystem
): SignalSelector<T, U> {
  const selector = function () {
    tracking.track(selector);

    const sourceValue = source._value;
    const currentVersion = source._version;

    // Check if cache is still valid
    if (
      selector._sourceVersion === currentVersion &&
      selector._cachedIndex !== undefined
    ) {
      // Try to use cached position
      if (Array.isArray(sourceValue)) {
        const index = selector._cachedIndex as number;
        const item = sourceValue[index] as unknown;
        if (item !== undefined && predicate(item, index)) {
          return item as U;
        }
      } else if (sourceValue instanceof Map) {
        const key = selector._cachedIndex;
        const item = sourceValue.get(key) as unknown;
        if (item !== undefined && predicate(item, key)) {
          return item as U;
        }
      } else if (sourceValue instanceof Set) {
        // Sets don't have stable indices, always re-search
      } else if (typeof sourceValue === 'object' && sourceValue !== null) {
        const key = selector._cachedIndex as string;
        const item = sourceValue[key as keyof typeof sourceValue];
        if (item !== undefined && predicate(item, key)) {
          return item as U;
        }
      }
    }

    // Cache miss or invalid - search for item
    if (Array.isArray(sourceValue)) {
      const index = sourceValue.findIndex((item, i) => predicate(item, i));
      if (index !== -1) {
        selector._cachedIndex = index;
        selector._sourceVersion = currentVersion;
        return sourceValue[index] as U;
      }
    } else if (sourceValue instanceof Map) {
      for (const [key, val] of sourceValue) {
        if (predicate(val, key as CacheKey)) {
          selector._cachedIndex = key as CacheKey;
          selector._sourceVersion = currentVersion;
          return val as U;
        }
      }
    } else if (sourceValue instanceof Set) {
      for (const val of sourceValue) {
        if (predicate(val)) {
          // Can't cache position in Set
          selector._sourceVersion = currentVersion;
          return val as U;
        }
      }
    } else if (typeof sourceValue === 'object' && sourceValue !== null) {
      for (const [key, val] of Object.entries(sourceValue)) {
        if (predicate(val, key)) {
          selector._cachedIndex = key as CacheKey;
          selector._sourceVersion = currentVersion;
          return val as U;
        }
      }
    }

    // Not found
    selector._cachedIndex = undefined;
    selector._sourceVersion = currentVersion;
    return undefined;
  } as SignalSelector<T, U>;

  // Initialize selector properties
  selector._source = source as Signal<T>;
  selector._predicate = predicate;
  selector._sourceVersion = -1; // Force initial search

  // Subscribe to source changes
  const listeners = new Set<() => void>();
  selector.subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Also subscribe to source if this is first listener
    if (listeners.size === 1) {
      const unsubscribe = source.subscribe(() => {
        // Notify all selector listeners
        for (const l of listeners) {
          batching.scheduleUpdate(l);
        }
      });
      // Store unsubscribe for cleanup
      selector._unsubscribeFromSource = unsubscribe;
    }

    return () => {
      listeners.delete(listener);
      // Unsubscribe from source if no more listeners
      if (listeners.size === 0 && selector._unsubscribeFromSource) {
        selector._unsubscribeFromSource();
        delete selector._unsubscribeFromSource;
      }
    };
  };

  return selector;
}

/**
 * Update a signal's value and notify listeners
 * Called by the set() function
 */
export function updateSignalValue<T>(
  signal: Signal<T>,
  newValue: T,
  batching: BatchingSystem
): void {
  const baseSignal = signal as BaseSignal<T>;
  if (Object.is(baseSignal._value, newValue)) return;

  baseSignal._value = newValue;
  baseSignal._version++;

  // Notify listeners with guard to prevent re-entrant subscriptions
  if (!baseSignal._listeners.size) return;

  batching.notify(() => {
    for (const listener of baseSignal._listeners) {
      batching.scheduleUpdate(listener);
    }
  });
}

/**
 * Get the underlying source signal from a signal selector
 */
export function getSourceSignal<T>(
  signal: Signal<T> | SignalSelector<unknown, T>
): Signal<unknown> | undefined {
  return (signal as unknown as SignalSelector<unknown, unknown>)._source;
}

/**
 * Check if a value is a signal selector
 */
export function isSignalSelector<T>(
  value: unknown
): value is SignalSelector<unknown, T> {
  return (
    typeof value === 'function' &&
    '_source' in value &&
    '_predicate' in value &&
    'subscribe' in value
  );
}
