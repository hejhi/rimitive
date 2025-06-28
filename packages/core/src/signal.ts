/**
 * @fileoverview Signal implementation for reactive state management
 *
 * Provides writable signals with smart update capabilities for
 * arrays and objects, automatic dependency tracking, and batched updates.
 */

import type { Signal } from './runtime-types';
import type { TrackingContext } from './tracking';
import type { BatchingSystem } from './batching';
import {
  findAndUpdateByKey,
  findAndUpdateMapByKey,
  addToSet,
  deleteFromSet,
  toggleInSet,
} from './predicates';

/**
 * Creates a signal factory bound to the given tracking and batching contexts
 */
export function createSignalFactory(
  tracking: TrackingContext,
  batching: BatchingSystem
) {
  /**
   * Creates a writable signal within this context
   */
  return function signal<T>(initialValue: T): Signal<T> {
    let value = initialValue;
    const listeners = new Set<() => void>();

    const sig = function (this: any, ...args: any[]) {
      if (arguments.length === 0) {
        // Reading - register as dependency if we're tracking
        tracking.track(sig);
        return value;
      }

      // Predicate-based find - returns found object
      if (
        arguments.length === 1 &&
        typeof args[0] === 'function' &&
        (Array.isArray(value) ||
          (typeof value === 'object' && value !== null))
      ) {
        const predicate = args[0];
        
        // Track the signal read
        tracking.track(sig);

        // Find and return the object
        if (Array.isArray(value)) {
          return value.find((item, index) => predicate(item, index));
        }

        // Handle Map searches
        if (value instanceof Map) {
          for (const [key, val] of value) {
            if (predicate(val, key)) {
              return val;
            }
          }
          return undefined;
        }

        // Handle Set searches
        if (value instanceof Set) {
          for (const val of value) {
            if (predicate(val)) {
              return val;
            }
          }
          return undefined;
        }

        // Handle regular object searches
        if (typeof value === 'object' && value !== null) {
          for (const [key, val] of Object.entries(value)) {
            if (predicate(val, key)) {
              return val;
            }
          }
          return undefined;
        }

        return undefined;
      }

      // Special Set operations - single argument
      if (arguments.length === 1 && value instanceof Set) {
        const arg = args[0];

        // Handle Set.add operation
        // Skip if the argument is a Set (full replacement)
        if (typeof arg !== 'function' && !(arg instanceof Set)) {
          const result = addToSet(value as any, arg);
          if (result.updated) {
            value = result.value as T;

            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          }
          return;
        }
      }

      // Special Set operations - string command + value/predicate
      if (
        arguments.length === 2 &&
        value instanceof Set &&
        typeof args[0] === 'string'
      ) {
        const [command, arg] = args;

        if (command === 'add') {
          const result = addToSet(value as any, arg);
          if (result.updated) {
            value = result.value as T;

            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          }
          return;
        }

        if (command === 'delete' && typeof arg === 'function') {
          const result = deleteFromSet(value as any, arg);
          if (result.updated) {
            value = result.value as T;

            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          }
          return;
        }

        if (command === 'toggle') {
          const result = toggleInSet(value as any, arg);
          if (result.updated) {
            value = result.value as T;

            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          }
          return;
        }
      }

      // Smart update for objects/Maps - key and update
      if (arguments.length === 2 && typeof args[1] === 'function') {
        const [key, update] = args;

        // Handle Map key updates
        if (value instanceof Map) {
          const result = findAndUpdateMapByKey(value as any, key, update);
          if (result.updated) {
            value = result.value as T;

            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          }
          return;
        }

        // Handle object property updates
        if (
          typeof args[0] === 'string' &&
          typeof value === 'object' &&
          value !== null
        ) {
          const result = findAndUpdateByKey(value as any, key, update);
          if (result.updated) {
            value = result.value as T;

            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          }
        }
        return;
      }

      // Regular write
      const newValue = args[0];
      if (Object.is(value, newValue)) return;

      value = newValue;

      for (const listener of listeners) {
        batching.scheduleUpdate(listener);
      }
      return; // Explicit return undefined for setter case
    };

    sig.subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    return sig as Signal<T>;
  };
}
