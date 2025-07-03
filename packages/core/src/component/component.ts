/**
 * @fileoverview Component-scoped Lattice implementation
 *
 * Provides component factories that receive scoped lattice contexts,
 * enabling proper composition and isolation between component trees.
 */

import type { ComponentContext, SetState, SignalState, Signal } from './types';
import { createLatticeContext } from './context';
import { applyUpdate } from './state-updates';

/**
 * Helper for creating partial updates with structural sharing
 * Re-exported from runtime for convenience
 */
export function partial<T>(key: keyof T, value: T[keyof T]): Partial<T> {
  return { [key]: value } as Partial<T>;
}

/**
 * Creates a component context with reactive state
 */
export function createComponent<State extends object>(
  initialState: State
): ComponentContext<State> {
  // Create scoped lattice context
  const lattice = createLatticeContext();

  // Create signals for state
  const stateSignals = {} as SignalState<State>;

  // Create a WeakMap to store signal -> key mappings for O(1) lookup
  const signalToKeyMap = new WeakMap<Signal<unknown>, keyof State>();

  // Initialize signals for all state keys
  (Object.keys(initialState) as (keyof State)[]).forEach((key) => {
    stateSignals[key] = lattice.signal(initialState[key]);
    // Add to map for O(1) lookup
    signalToKeyMap.set(stateSignals[key] as Signal<unknown>, key);
  });

  // Create set function that writes directly to signals
  const set: SetState = ((
    target: Signal<unknown> | SignalState<State>,
    updates?: unknown
  ) => {
    // Check if it's a batch update on the store
    if (target === stateSignals) {
      // Batch update - update multiple signals at once
      lattice._batch(() => {
        // Get current state from all signals
        const currentState = {} as State;
        (Object.keys(stateSignals) as (keyof State)[]).forEach((key) => {
          currentState[key] = stateSignals[key]();
        });

        // Calculate new state
        const newState =
          typeof updates === 'function'
            ? (updates as (prev: State) => Partial<State>)(currentState)
            : (updates as Partial<State>);

        // Update each changed signal
        (
          Object.entries(newState) as [keyof State, State[keyof State]][]
        ).forEach(([key, value]) => {
          if (key in stateSignals && !Object.is(stateSignals[key](), value)) {
            lattice.set(stateSignals[key], value);
          }
        });
      });
      return;
    }

    // Single signal update
    const signal = target as Signal<unknown>;
    const currentValue = signal();
    const newValue = applyUpdate(currentValue, updates);
    lattice.set(signal, newValue);
  }) as SetState;

  // Create component context with merged functionality
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    effect: lattice.effect,
    set,
  };

  return context;
}
