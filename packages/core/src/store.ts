/**
 * @fileoverview Minimal store implementation for Lattice
 *
 * Provides a state container with signal-based reactivity and
 * batched updates, built on top of Lattice context primitives.
 */

import type { LatticeContext, SignalState } from './types';
import type { Computed } from '@lattice/signals';
import { createLattice } from './context';

// Store constructor
function StoreImpl(
  this: Store<object>,
  state: SignalState<object>,
  context: LatticeContext
) {
  this.state = state;
  this._context = context;
}

// Cast to constructor type
const Store = StoreImpl as unknown as {
  new <T extends object>(
    state: SignalState<T>,
    context: LatticeContext
  ): Store<T>;
  prototype: Store<object>;
};

// Select method - create computed selector from store state
Store.prototype.select = function <T extends object, R>(
  this: Store<T>,
  selector: (state: T) => R
): Computed<R> {
  return this._context.computed(() => {
    // Build state object by reading all signal values
    // Note: This makes ALL signals dependencies of the computed value.
    // For fine-grained reactivity, access individual signals directly:
    // const count = store.getContext().computed(() => store.state.count.value)
    const currentState = {} as T;
    for (const [key, signal] of Object.entries(this.state) as [
      keyof T,
      SignalState<T>[keyof T],
    ][]) {
      currentState[key] = signal.value;
    }
    return selector(currentState);
  });
};

// Set method - update state with automatic batching
Store.prototype.set = function <T extends object>(
  this: Store<T>,
  updates: Partial<T> | ((current: T) => Partial<T>)
): void {
  this._context.batch(() => {
    // Get current state from all signals
    const current = {} as T;
    for (const [key, signal] of Object.entries(this.state) as [
      keyof T,
      SignalState<T>[keyof T],
    ][]) {
      current[key] = signal.peek();
    }

    // Calculate new state
    const newState = typeof updates === 'function' ? updates(current) : updates;

    // Update changed signals
    for (const [key, value] of Object.entries(newState) as [
      keyof T,
      T[keyof T],
    ][]) {
      if (key in this.state && !Object.is(this.state[key].peek(), value)) {
        this.state[key].value = value;
      }
    }
  });
};

// Get context method
Store.prototype.getContext = function <T extends object>(
  this: Store<T>
): LatticeContext {
  return this._context;
};

// Dispose method
Store.prototype.dispose = function <T extends object>(this: Store<T>): void {
  this._context.dispose();
};

/**
 * Helper for creating partial updates with structural sharing
 */
export function partial<T>(key: keyof T, value: T[keyof T]): Partial<T> {
  return { [key]: value } as Partial<T>;
}

/**
 * Store instance with state management capabilities
 */
export interface Store<T extends object> {
  /** Signal-based state object */
  state: SignalState<T>;

  /** Private context instance */
  _context: LatticeContext;

  /** Create a computed selector from store state */
  select<R>(selector: (state: T) => R): Computed<R>;

  /** Update state with automatic batching */
  set(updates: Partial<T> | ((current: T) => Partial<T>)): void;

  /** Get the underlying context */
  getContext(): LatticeContext;

  /** Dispose the store and all its resources */
  dispose(): void;
}

/**
 * Creates a reactive store with signal-based state management
 *
 * @param initialState - Initial state object
 * @param context - Optional context to use (creates new one if not provided)
 * @returns Store instance with state and update methods
 *
 * @example
 * ```typescript
 * const store = createStore({ count: 0, name: 'Test' });
 *
 * // Read state directly
 * console.log(store.state.count.value); // 0
 *
 * // Create computed selectors
 * const count = store.select(s => s.count);
 * const uppercaseName = store.select(s => s.name.toUpperCase());
 * const combined = store.select(s => ({ count: s.count, name: s.name }));
 *
 * // Update state (automatically batched)
 * store.set({ count: 1, name: 'Updated' });
 *
 * // Use effects to react to changes
 * const ctx = store.getContext();
 * const unsubscribe = ctx.effect(() => {
 *   console.log('Count is:', count.value);
 * });
 * ```
 */
export function createStore<T extends object>(
  initialState: T,
  context?: LatticeContext
): Store<T> {
  const ctx = context ?? createLattice();

  // Create signal map from initial state
  const signals = {} as SignalState<T>;
  for (const [key, value] of Object.entries(initialState) as [
    keyof T,
    T[keyof T],
  ][]) {
    signals[key] = ctx.signal(value, key.toLocaleString());
  }

  // Return a new Store instance
  return new Store(signals, ctx);
}
