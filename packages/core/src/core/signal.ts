/**
 * @fileoverview Signal implementation for reactive state management
 *
 * Provides read-only signals that can create derived signals with predicates.
 * All updates must go through the set() function.
 */

import type { Signal } from '../component/types';
import type { TrackingContext } from './tracking';
import type { BatchingSystem } from './batching';

/**
 * Valid cache key types for collections
 */
type CacheKey = number | string | symbol;

/**
 * Derived signal maintains a reference to its source and cached position
 */
export interface DerivedSignal<T, U> extends Signal<U | undefined> {
  _source: Signal<T>;
  _predicate: (
    value: T extends Array<infer E>
      ? E
      : T extends Set<infer E>
        ? E
        : T extends Map<infer K, infer V>
          ? [K, V]
          : T[keyof T],
    key?: CacheKey
  ) => boolean;
  _cachedIndex?: CacheKey; // Position/key in source
  _sourceVersion: number; // Version of source when cached
  _unsubscribeFromSource?: () => void; // Cleanup function
}

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
  // WeakMap to store keyed selector caches
  const keyedSelectorCaches = new WeakMap<
    Signal<unknown>,
    Map<Function, Map<unknown, WeakRef<Signal<unknown>>>>
  >();

  /**
   * Creates a read-only signal within this context
   */
  return function signal<T>(initialValue: T): Signal<T> {
    const sig = function (this: unknown, ...args: unknown[]) {
      // Read operation
      if (arguments.length === 0) {
        tracking.track(sig);
        return (sig as BaseSignal<T>)._value;
      }

      // Single predicate - create derived signal
      if (arguments.length === 1 && typeof args[0] === 'function') {
        return createDerivedSignal(
          sig as BaseSignal<T>,
          args[0] as (value: unknown, key?: CacheKey) => boolean,
          tracking,
          batching
        );
      }

      // Keyed selector - keyFn and predicate
      if (
        arguments.length === 2 &&
        typeof args[0] === 'function' &&
        typeof args[1] === 'function'
      ) {
        const [keyFn, predicate] = args;

        // Get or create cache for this signal
        if (!keyedSelectorCaches.has(sig as unknown as Signal<unknown>)) {
          keyedSelectorCaches.set(sig as unknown as Signal<unknown>, new Map());
        }
        const signalCache = keyedSelectorCaches.get(
          sig as unknown as Signal<unknown>
        )!;

        // Get or create cache for this keyFn
        if (!signalCache.has(keyFn)) {
          const keyedCache = new Map<unknown, WeakRef<Signal<unknown>>>();
          signalCache.set(keyFn, keyedCache);
        }
        const keyCache = signalCache.get(keyFn);

        // Return function that creates/returns cached derived signals
        return (key: unknown) => {
          const ref = keyCache?.get(key);
          let signal = ref?.deref();

          if (ref && !signal) {
            // WeakRef is dead, remove it
            keyCache?.delete(key);
          }

          if (!signal) {
            // Create new derived signal
            signal = createDerivedSignal(
              sig as BaseSignal<T>,
              (item: unknown) => predicate(item, key),
              tracking,
              batching
            );
            keyCache?.set(key, new WeakRef(signal));
          }

          return signal;
        };
      }

      throw new Error(
        'Invalid signal operation. Signals are read-only. Use set() to update.'
      );
    } as BaseSignal<T>;

    // Initialize signal properties
    sig._value = initialValue;
    sig._version = 0;
    sig._listeners = new Set<() => void>();

    sig.subscribe = (listener: () => void) => {
      sig._listeners.add(listener);
      return () => sig._listeners.delete(listener);
    };

    return sig as Signal<T>;
  };
}

/**
 * Creates a derived signal that tracks a predicate result
 */
function createDerivedSignal<T, U>(
  source: BaseSignal<T>,
  predicate: (value: unknown, key?: CacheKey) => boolean,
  tracking: TrackingContext,
  batching: BatchingSystem
): DerivedSignal<T, U> {
  const derived = function () {
    tracking.track(derived);

    const sourceValue = source._value;
    const currentVersion = source._version;

    // Check if cache is still valid
    if (
      derived._sourceVersion === currentVersion &&
      derived._cachedIndex !== undefined
    ) {
      // Try to use cached position
      if (Array.isArray(sourceValue)) {
        const item = sourceValue[derived._cachedIndex as number];
        if (item !== undefined && predicate(item, derived._cachedIndex)) {
          return item as U;
        }
      } else if (sourceValue instanceof Map) {
        const item = sourceValue.get(derived._cachedIndex);
        if (item !== undefined && predicate(item, derived._cachedIndex)) {
          return item as U;
        }
      } else if (sourceValue instanceof Set) {
        // Sets don't have stable indices, always re-search
      } else if (typeof sourceValue === 'object' && sourceValue !== null) {
        const key = derived._cachedIndex as string;
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
        derived._cachedIndex = index;
        derived._sourceVersion = currentVersion;
        return sourceValue[index] as U;
      }
    } else if (sourceValue instanceof Map) {
      for (const [key, val] of sourceValue) {
        if (predicate(val, key)) {
          derived._cachedIndex = key;
          derived._sourceVersion = currentVersion;
          return val as U;
        }
      }
    } else if (sourceValue instanceof Set) {
      for (const val of sourceValue) {
        if (predicate(val)) {
          // Can't cache position in Set
          derived._sourceVersion = currentVersion;
          return val as U;
        }
      }
    } else if (typeof sourceValue === 'object' && sourceValue !== null) {
      for (const [key, val] of Object.entries(sourceValue)) {
        if (predicate(val, key)) {
          derived._cachedIndex = key;
          derived._sourceVersion = currentVersion;
          return val as U;
        }
      }
    }

    // Not found
    derived._cachedIndex = undefined;
    derived._sourceVersion = currentVersion;
    return undefined;
  } as DerivedSignal<T, U>;

  // Initialize derived signal properties
  derived._source = source;
  derived._predicate = predicate;
  derived._sourceVersion = -1; // Force initial search

  // Subscribe to source changes
  const listeners = new Set<() => void>();
  derived.subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Also subscribe to source if this is first listener
    if (listeners.size === 1) {
      const unsubscribe = source.subscribe(() => {
        // Notify all derived listeners
        for (const l of listeners) {
          batching.scheduleUpdate(l);
        }
      });
      // Store unsubscribe for cleanup
      derived._unsubscribeFromSource = unsubscribe;
    }

    return () => {
      listeners.delete(listener);
      // Unsubscribe from source if no more listeners
      if (listeners.size === 0 && derived._unsubscribeFromSource) {
        derived._unsubscribeFromSource();
        delete derived._unsubscribeFromSource;
      }
    };
  };

  return derived;
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

  for (const listener of baseSignal._listeners) {
    batching.scheduleUpdate(listener);
  }
}

/**
 * Get the underlying source signal from a derived signal
 */
export function getSourceSignal<T>(
  signal: Signal<T>
): Signal<unknown> | undefined {
  return (signal as unknown as DerivedSignal<unknown, unknown>)._source;
}

/**
 * Check if a signal is a derived signal
 */
export function isDerivedSignal<T>(
  signal: Signal<T>
): signal is DerivedSignal<any, any> {
  return '_source' in signal && '_predicate' in signal;
}
