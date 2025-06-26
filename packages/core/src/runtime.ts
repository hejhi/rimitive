/**
 * @fileoverview Signals-based Lattice runtime
 *
 * This implementation provides signals-first reactivity with automatic dependency tracking:
 * - signal<T>(value) creates writable reactive primitives
 * - computed<T>(fn) creates derived reactive values with auto dependency tracking
 * - Global tracking context for automatic dependency detection
 * - No proxies, uses function overloading and context tracking
 */

import type {
  ReactiveSliceFactory,
  Signal,
  Computed,
  SignalState,
  SliceHandle,
  SetState,
} from './runtime-types';
import { type StoreAdapter } from './adapter-contract';

/**
 * Helper for creating partial updates with structural sharing
 * Enables surgical updates similar to main branch
 */
export function partial<T extends Record<string, any>>(
  key: keyof T,
  value: any
): Partial<T> {
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
    for (const update of batchedUpdates) {
      update();
    }
    // Run all batched notifications
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
export function signal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const listeners = new Set<() => void>();

  const sig = function (newValue?: T) {
    if (arguments.length === 0) {
      // Reading - register as dependency if we're tracking
      if (trackingContext) trackingContext.add(sig);
      return value;
    }

    if (Object.is(value, newValue)) return;

    // Writing - update value and notify if changed
    value = newValue!;

    for (const listener of listeners) {
      if (isBatching) {
        // Add notifications to batch
        batchedUpdates.add(listener);
        continue;
      }

      // Immediate notifications
      listener();
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
      for (const unsub of unsubscribers) {
        unsub();
      }
      unsubscribers = [];

      // Track dependencies during computation
      const prevContext = trackingContext;

      try {
        trackingContext = new Set<Signal<T>>();
        value = computeFn();

        // Subscribe to new dependencies
        for (const dep of trackingContext) {
          const unsub = dep.subscribe(() => {
            if (isComputing) return;

            // Only mark stale if not currently computing
            isStale = true;
            for (const listener of listeners) {
              if (isBatching) {
                // Add notifications to batch
                batchedUpdates.add(listener);
                continue;
              }

              // Immediate notifications
              listener();
            }
          });
          unsubscribers.push(unsub);
        }

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
    if (trackingContext) trackingContext.add(comp);

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

/**
 * Helper to create a read-only wrapper for an internal signal
 * Extracted for reuse and performance
 */
function createReadOnlyWrapper<T, State>(
  internalSig: Signal<T>,
  signalsRef: SignalState<State>,
  key: keyof SignalState<State>
): Signal<T> {
  const wrapper = () => {
    // Track dependencies when accessed
    if (trackingContext) trackingContext.add(signalsRef[key]);
    return internalSig();
  };

  // Attach methods without Object.assign overhead
  wrapper.subscribe = internalSig.subscribe;
  wrapper.readonly = true;

  return wrapper;
}

/**
 * Creates read-only signals that mirror adapter state
 * Provides unidirectional sync from adapter to signals only
 */
function createReadOnlySignals<State>(
  adapter: StoreAdapter<State>
): SignalState<State> {
  const state = adapter.getState();
  const signals = {} as SignalState<State>;
  const internalSignals = {} as Record<
    keyof State,
    Signal<State[Extract<keyof State, string>]>
  >;

  // Create internal writable signals and expose read-only versions
  for (const key in state) {
    const internalSig = signal(state[key]);
    internalSignals[key] = internalSig;
    signals[key] = createReadOnlyWrapper(internalSig, signals, key);
  }

  // Unidirectional sync: adapter changes update signals
  adapter.subscribe(() => {
    runBatched(() => {
      const newState = adapter.getState();

      // Single loop to handle both updates and new keys
      for (const key in newState) {
        const newVal = newState[key];
        const existingSig = internalSignals[key];

        if (existingSig) {
          if (!Object.is(existingSig(), newVal)) {
            // Update existing signal if value changed
            existingSig(newVal);
          }
          continue;
        }

        // Create new signal for new key
        const internalSig = signal(newVal);
        internalSignals[key] = internalSig;
        signals[key] = createReadOnlyWrapper(internalSig, signals, key);
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
    const set: SetState<State> = (
      updates: Partial<State> | ((state: SignalState<State>) => Partial<State>)
    ) => {
      // Function form (compute minimal updates) or direct object form
      adapter.setState(
        typeof updates === 'function' ? updates(signalState) : updates
      );
    };
    // Execute the computation function - it will automatically track signal dependencies
    const computedResult = computeFn(signalState, set);

    // Create the slice handle with composition capability
    function slice(): Computed;
    function slice<ChildDeps>(
      childFn: (parent: Computed) => ChildDeps
    ): ChildDeps;
    function slice<ChildDeps>(childFn?: (parent: Computed) => ChildDeps) {
      if (!childFn) return computedResult;

      // Execute the child function - it will extract specific parts for composition
      return childFn(computedResult);
    }

    return slice;
  };
}
