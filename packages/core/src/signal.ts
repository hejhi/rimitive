/**
 * @fileoverview Signal implementation for reactive state management
 * 
 * Provides writable signals with smart update capabilities for
 * arrays and objects, automatic dependency tracking, and batched updates.
 */

import type { Signal } from './runtime-types';
import type { TrackingContext } from './tracking';
import type { BatchingSystem } from './batching';
import { findAndUpdateArray, findAndUpdateByKey, findAndUpdateByPredicate } from './finders';

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
    
    const sig = function (...args: any[]) {
      if (arguments.length === 0) {
        // Reading - register as dependency if we're tracking
        tracking.track(sig);
        return value;
      }
      
      // Smart update - two functions passed
      if (arguments.length === 2 && typeof args[0] === 'function' && typeof args[1] === 'function') {
        const [finder, updater] = args;
        
        // Handle array updates
        if (Array.isArray(value)) {
          const result = findAndUpdateArray(value, finder, updater);
          if (result.updated) {
            value = result.value as T;
            
            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          }
          return;
        }
        
        // Handle object updates with predicate
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const result = findAndUpdateByPredicate(value, finder, updater);
          if (result.updated) {
            value = result.value as T;
            
            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          }
        }
        
        return;
      }
      
      // Smart update for objects - property key and updater
      if (arguments.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'function') {
        const [key, updater] = args;
        
        if (typeof value === 'object' && value !== null) {
          const result = findAndUpdateByKey(value as any, key, updater);
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