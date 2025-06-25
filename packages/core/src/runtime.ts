/**
 * @fileoverview Signals-based Lattice runtime
 * 
 * This implementation provides signals-first reactivity with automatic dependency tracking:
 * - signal<T>(value) creates writable reactive primitives
 * - computed<T>(fn) creates derived reactive values with auto dependency tracking
 * - Global tracking context for automatic dependency detection
 * - No proxies, uses function overloading and context tracking
 */

import type { ReactiveSliceFactory, Signal, Computed, SignalState, SliceHandle } from './runtime-types';
import { storeSliceMetadata, storeCompositionMetadata } from './lib/metadata';
import { type StoreAdapter } from './adapter-contract';

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
 * Creates a signal state object from a store adapter
 * Provides bidirectional sync between signals and the underlying store
 */
function createSignalState<State>(adapter: StoreAdapter<State>): SignalState<State> {
  const state = adapter.getState();
  const signals = {} as SignalState<State>;
  
  // Create signals for each state property
  for (const key in state) {
    const sig = signal(state[key]);
    
    // When signal changes, update the store
    sig.subscribe(() => {
      adapter.setState({ [key]: sig() } as unknown as Partial<State>);
    });
    
    signals[key] = sig;
  }
  
  // When store changes, update signals
  adapter.subscribe(() => {
    runBatched(() => {
      const newState = adapter.getState();
      for (const key in newState) {
        if (signals[key] && !Object.is(signals[key](), newState[key])) {
          signals[key](newState[key]);
        }
      }
      
      // Add new signals for any new keys
      for (const key in newState) {
        if (!signals[key]) {
          const sig = signal(newState[key]);
          sig.subscribe(() => {
            adapter.setState({ [key]: sig() } as unknown as Partial<State>);
          });
          signals[key] = sig;
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
  const signalState = createSignalState(adapter);
  
  return function createSlice<Computed>(
    computeFn: (state: SignalState<State>) => Computed
  ): SliceHandle<Computed> {
    // Execute the computation function - it will automatically track signal dependencies
    const computedResult = computeFn(signalState);
    
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