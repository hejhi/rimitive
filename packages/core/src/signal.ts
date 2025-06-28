/**
 * @fileoverview Signal implementation for reactive state management
 * 
 * Provides writable signals with smart update capabilities for
 * arrays and objects, automatic dependency tracking, and batched updates.
 */

import type { Signal } from './runtime-types';
import type { TrackingContext } from './tracking';
import type { BatchingSystem } from './batching';

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
          const index = value.findIndex((item, idx) => finder(item, idx));
          if (index !== -1) {
            const newArray = [...value];
            const oldItem = value[index];
            const newItem = updater(oldItem, index);
            
            // Only update if item actually changed
            if (!Object.is(oldItem, newItem)) {
              newArray[index] = newItem;
              value = newArray as T;
              
              for (const listener of listeners) {
                batching.scheduleUpdate(listener);
              }
            }
          }
          return;
        }
        
        // Handle object updates - finder returns the key to update
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // For objects, the finder should return the key to update
          const entries = Object.entries(value);
          for (const [key, val] of entries) {
            if (finder(val, key)) {
              const newValue = updater(val, key);
              if (!Object.is(val, newValue)) {
                value = { ...value, [key]: newValue } as T;
                
                for (const listener of listeners) {
                  batching.scheduleUpdate(listener);
                }
              }
              return; // Only update first matching entry
            }
          }
        }
        
        return;
      }
      
      // Smart update for objects - property key and updater
      if (arguments.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'function') {
        const [key, updater] = args;
        
        if (typeof value === 'object' && value !== null && key in value) {
          const oldValue = (value as any)[key];
          const newFieldValue = updater(oldValue);
          
          if (!Object.is(oldValue, newFieldValue)) {
            value = { ...value, [key]: newFieldValue } as T;
            
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