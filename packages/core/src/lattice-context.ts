/**
 * @fileoverview Scoped lattice context implementation
 * 
 * Provides isolated signal/computed contexts for component trees,
 * eliminating global state conflicts and enabling proper composition.
 */

import type {
  Signal,
  Computed,
  LatticeContext,
  SetState,
} from './runtime-types';

/**
 * Creates a tracking context for dependency tracking - scoped per component tree
 */
function createTrackingContext() {
  let dependencies: Set<Signal<any>> | null = null;
  
  function track<T>(signal: Signal<T>): void {
    if (dependencies) {
      dependencies.add(signal);
    }
  }
  
  function capture<T>(fn: () => T): { value: T; deps: Set<Signal<any>> } {
    const prevDeps = dependencies;
    dependencies = new Set();
    
    try {
      const value = fn();
      return { value, deps: dependencies };
    } finally {
      dependencies = prevDeps;
    }
  }
  
  function isTracking(): boolean {
    return dependencies !== null;
  }
  
  return { track, capture, isTracking };
}

/**
 * Creates a batching system for signal updates - scoped per context
 */
function createBatchingSystem() {
  let isBatching = false;
  const batchedUpdates = new Set<() => void>();
  
  function batch(fn: () => void): void {
    if (isBatching) {
      fn();
      return;
    }
    
    isBatching = true;
    try {
      fn();
      // Run all batched notifications
      for (const update of batchedUpdates) {
        update();
      }
      batchedUpdates.clear();
    } finally {
      isBatching = false;
    }
  }
  
  function scheduleUpdate(listener: () => void): void {
    if (isBatching) {
      batchedUpdates.add(listener);
    } else {
      listener();
    }
  }
  
  return { 
    batch, 
    scheduleUpdate,
    get batching() { return isBatching; }
  };
}

/**
 * Creates a scoped lattice context for a component tree
 */
export function createLatticeContext<State>(): LatticeContext<State> & { _batch: (fn: () => void) => void } {
  const tracking = createTrackingContext();
  const batching = createBatchingSystem();
  
  /**
   * Creates a writable signal within this context
   */
  function signal<T>(initialValue: T): Signal<T> {
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
          const index = value.findIndex(finder);
          if (index !== -1) {
            const newArray = [...value];
            const oldItem = value[index];
            const newItem = updater(oldItem);
            
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
        
        // Could extend to handle object updates here
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
  }
  
  /**
   * Creates a computed signal that derives its value from other signals
   * Dependencies are tracked automatically when the computation runs
   */
  function computed<T>(computeFn: () => T): Computed<T> {
    let value: T;
    let isStale = true;
    let isComputing = false; // Prevent infinite recomputation loops
    let unsubscribers: (() => void)[] = [];
    const listeners = new Set<() => void>();
    
    const recompute = () => {
      if (isComputing) return; // Prevent infinite loops
      isComputing = true;
      
      try {
        // Clean up old dependency subscriptions
        for (const unsub of unsubscribers) {
          unsub();
        }
        unsubscribers = [];
        
        // Track dependencies during computation
        const { value: newValue, deps } = tracking.capture(computeFn);
        value = newValue;
        
        // Subscribe to new dependencies
        for (const dep of deps) {
          const unsub = dep.subscribe(() => {
            if (isComputing) return;
            
            // Only mark stale if not currently computing
            isStale = true;
            for (const listener of listeners) {
              batching.scheduleUpdate(listener);
            }
          });
          unsubscribers.push(unsub);
        }
        
        isStale = false;
      } finally {
        isComputing = false;
      }
    };
    
    const comp = (() => {
      // Register this computed as a dependency if we're in a tracking context
      tracking.track(comp);
      
      // Recompute if stale
      if (isStale && !isComputing) recompute();
      
      return value;
    }) as Computed<T>;
    
    comp.subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    
    return comp;
  }
  
  // Placeholder set function - will be provided when creating store
  const set: SetState<State> = () => {
    throw new Error('set() is only available when component is connected to a store');
  };
  
  return {
    signal,
    computed,
    set,
    // Internal method for store integration
    _batch: batching.batch,
  };
}