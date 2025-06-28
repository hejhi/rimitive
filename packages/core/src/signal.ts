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
  findAndUpdateArray,
  findAndUpdateByKey,
  findAndUpdateByPredicate,
  findAndUpdateMapByKey,
  findAndUpdateMapByValuePredicate,
  findAndUpdateSetFirst,
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

      // Predicate-based update - returns update function
      if (
        arguments.length === 1 &&
        typeof args[0] === 'function' &&
        (Array.isArray(value) ||
          (typeof value === 'object' && value !== null))
      ) {
        const predicate = args[0];

        // Return update function
        return function(updateArg: any) {
          let updateFn: (item: any, index?: any) => any;
          
          // Handle partial object update
          if (typeof updateArg === 'object' && 
              updateArg !== null && 
              !Array.isArray(updateArg) &&
              typeof updateArg === 'object') {
            // For arrays, objects, and maps - allow partial updates
            updateFn = (item: any) => {
              if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                return { ...item, ...updateArg };
              }
              // If item is not an object, fall back to replacement
              return updateArg;
            };
          } else if (typeof updateArg === 'function') {
            updateFn = updateArg;
          } else {
            throw new Error('Update argument must be a function or object');
          }

          // Handle array updates
          if (Array.isArray(value)) {
            const result = findAndUpdateArray(value, predicate, updateFn);
            if (result.updated) {
              value = result.value as T;

              for (const listener of listeners) {
                batching.scheduleUpdate(listener);
              }
            }
            return;
          }

          // Handle object updates with predicate
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
          ) {
            // Handle Map updates
            if (value instanceof Map) {
              const result = findAndUpdateMapByValuePredicate(
                value,
                predicate,
                updateFn
              );
              if (result.updated) {
                value = result.value as T;

                for (const listener of listeners) {
                  batching.scheduleUpdate(listener);
                }
              }
              return;
            }

            // Handle Set updates
            if (value instanceof Set) {
              const result = findAndUpdateSetFirst(value, predicate, updateFn);
              if (result.updated) {
                value = result.value as T;

                for (const listener of listeners) {
                  batching.scheduleUpdate(listener);
                }
              }
              return;
            }

            // Handle regular object updates
            const result = findAndUpdateByPredicate(value, predicate, updateFn);
            if (result.updated) {
              value = result.value as T;

              for (const listener of listeners) {
                batching.scheduleUpdate(listener);
              }
            }
          }
        };
      }

      // Special Set operations - single argument
      if (arguments.length === 1 && value instanceof Set) {
        const arg = args[0];

        // Handle Set.add operation
        if (typeof arg !== 'function') {
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
