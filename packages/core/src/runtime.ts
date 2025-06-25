/**
 * @fileoverview Signals-based Lattice runtime
 * 
 * This implementation provides signals-first reactivity with automatic dependency tracking:
 * - signal<T>(value) creates writable reactive primitives
 * - computed<T>(fn) creates derived reactive values with auto dependency tracking
 * - Global tracking context for automatic dependency detection
 * - No proxies, uses function overloading and context tracking
 */

import type { ReactiveSliceFactory, Signal, Computed, SignalState, SliceHandle, SetState } from './runtime-types';
import { storeSliceMetadata, storeCompositionMetadata } from './lib/metadata';
import { type StoreAdapter } from './adapter-contract';

/**
 * Helper for creating partial updates with structural sharing
 * Enables surgical updates similar to main branch
 */
export function partial<T extends Record<string, any>>(key: keyof T, value: any): Partial<T> {
  return { [key]: value } as Partial<T>;
}

// Global dependency tracking context
let trackingContext: Set<Signal<any>> | null = null;

// Batching system for signal updates
let isBatching = false;
const batchedUpdates = new Set<() => void>();

function runBatched(fn: () => void) {
  if (isBatching) {
    fn();
    return;
  }
  
  isBatching = true;
  try {
    fn();
    // Run all batched notifications
    batchedUpdates.forEach(update => update());
    batchedUpdates.clear();
  } finally {
    isBatching = false;
  }
}

/**
 * Component factory receives slice factory and returns the component's slices
 */
export type ComponentFactory<Component, State> = (
  createSlice: ReactiveSliceFactory<State>
) => Component;

/**
 * Creates a writable signal that notifies subscribers when its value changes
 */
// Symbol to distinguish read vs write operations
const READ_SIGNAL = Symbol('read');

export function signal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const listeners = new Set<() => void>();
  
  const sig = function(newValue?: T | typeof READ_SIGNAL) {
    if (arguments.length === 0) {
      // Reading - register as dependency if we're tracking
      if (trackingContext) {
        trackingContext.add(sig);
      }
      return value;
    } else {
      // Writing - update value and notify if changed
      if (!Object.is(value, newValue)) {
        value = newValue as T;
        
        if (isBatching) {
          // Add notifications to batch
          listeners.forEach(listener => batchedUpdates.add(listener));
        } else {
          // Immediate notifications
          listeners.forEach(listener => listener());
        }
      }
      return; // Explicit return undefined for setter case
    }
  } as Signal<T>;
  
  sig.subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  
  return sig;
}

/**
 * Creates a computed signal that derives its value from other signals
 * Dependencies are tracked automatically when the computation runs
 */
export function computed<T>(computeFn: () => T): Computed<T> {
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
      unsubscribers.forEach(unsub => unsub());
      unsubscribers = [];
      
      // Track dependencies during computation
      const dependencies = new Set<Signal<any>>();
      const prevContext = trackingContext;
      trackingContext = dependencies;
      
      try {
        value = computeFn();
        
        // Subscribe to new dependencies
        dependencies.forEach(dep => {
          const unsub = dep.subscribe(() => {
            if (!isComputing) { // Only mark stale if not currently computing
              isStale = true;
              if (isBatching) {
                // Add notifications to batch
                listeners.forEach(listener => batchedUpdates.add(listener));
              } else {
                // Immediate notifications
                listeners.forEach(listener => listener());
              }
            }
          });
          unsubscribers.push(unsub);
        });
        
        isStale = false;
      } finally {
        trackingContext = prevContext;
      }
    } finally {
      isComputing = false;
    }
  };
  
  const comp = (() => {
    // Register this computed as a dependency if we're in a tracking context
    if (trackingContext) {
      trackingContext.add(comp);
    }
    
    // Recompute if stale
    if (isStale && !isComputing) {
      recompute();
    }
    
    return value;
  }) as Computed<T>;
  
  comp.subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  
  return comp;
}

/**
 * Creates read-only signals that mirror adapter state
 * Provides unidirectional sync from adapter to signals only
 */
function createReadOnlySignals<State>(adapter: StoreAdapter<State>): SignalState<State> {
  const state = adapter.getState();
  const signals = {} as SignalState<State>;
  const internalSignals = {} as Record<keyof State, Signal<State[keyof State]>>;
  
  // Create internal writable signals and expose read-only versions
  for (const key in state) {
    const internalSig = signal(state[key]);
    (internalSignals as any)[key] = internalSig;
    
    // Create read-only wrapper
    signals[key] = Object.assign(
      () => {
        // Track dependencies when accessed
        if (trackingContext) {
          trackingContext.add(signals[key]);
        }
        return internalSig();
      },
      {
        subscribe: internalSig.subscribe,
        readonly: true
      }
    ) as Signal<State[typeof key]>;
  }
  
  // Unidirectional sync: adapter changes update signals
  adapter.subscribe(() => {
    runBatched(() => {
      const newState = adapter.getState();
      
      // Update existing signals
      for (const key in newState) {
        if (internalSignals[key] && !Object.is(internalSignals[key](), newState[key])) {
          internalSignals[key](newState[key]);
        }
      }
      
      // Add new signals for any new keys
      for (const key in newState) {
        if (!internalSignals[key]) {
          const internalSig = signal(newState[key]);
          (internalSignals as any)[key] = internalSig;
          
          // Create read-only wrapper for new signal
          signals[key] = Object.assign(
            () => {
              if (trackingContext) {
                trackingContext.add(signals[key]);
              }
              return internalSig();
            },
            {
              subscribe: internalSig.subscribe,
              readonly: true
            }
          ) as Signal<State[typeof key]>;
        }
      }
    });
  });
  
  return signals;
}

/**
 * Creates a reactive slice factory using signals-based reactivity
 */
export function createLatticeStore<State>(
  adapter: StoreAdapter<State>
): ReactiveSliceFactory<State> {
  const signalState = createReadOnlySignals(adapter);
  
  return function createSlice<Computed>(
    computeFn: (state: SignalState<State>, set: SetState<State>) => Computed
  ): SliceHandle<Computed> {
    // Create set function that supports both full and partial updates
    const set: SetState<State> = (updates: Partial<State> | ((state: SignalState<State>) => Partial<State>)) => {
      if (typeof updates === 'function') {
        // Function form - compute minimal updates
        const partialUpdates = updates(signalState);
        adapter.setState(partialUpdates);
      } else {
        // Direct object form
        adapter.setState(updates);
      }
    };
    // Execute the computation function - it will automatically track signal dependencies
    const computedResult = computeFn(signalState, set);
    
    // Create the slice handle with composition capability
    function slice(): Computed;
    function slice<ChildDeps>(childFn: (parent: Computed) => ChildDeps): ChildDeps;
    function slice<ChildDeps>(childFn?: (parent: Computed) => ChildDeps) {
      if (!childFn) {
        return computedResult as Computed;
      }
      
      // Execute the child function - it will extract specific parts for composition
      const childDeps = childFn(computedResult as Computed);
      
      // Store composition metadata for any functions in the result
      for (const key in childDeps) {
        const value = childDeps[key];
        if (typeof value === 'function') {
          storeCompositionMetadata(value, { 
            slice: slice as SliceHandle<unknown>, 
            dependencies: new Set() // Will be tracked by signal system
          });
        }
      }
      
      return childDeps;
    }
    
    // Store metadata for the slice
    storeSliceMetadata(slice as SliceHandle<Computed>, { 
      dependencies: new Set(), // Dependencies tracked by signals now
      subscribe: () => () => {} // TODO: Implement slice-level subscription if needed
    });
    
    return slice as SliceHandle<Computed>;
  };
}