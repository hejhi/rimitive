/**
 * @fileoverview Component-scoped Lattice implementation
 *
 * Provides component factories that receive scoped lattice contexts,
 * enabling proper composition and isolation between component trees.
 */

import type { ComponentContext, SignalState, Signal, SetState } from './types';
import { createLatticeContext } from './context';

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

  // Create set function for batch updates only
  const set: SetState = <S>(
    store: SignalState<S>,
    updates: Partial<S> | ((current: S) => Partial<S>)
  ): void => {
    // Only handle batch updates on the component's own store
    if ((store as unknown) !== stateSignals) {
      throw new Error('set() can only be called on the component store');
    }

    // Type assertion is safe because we verified store === stateSignals
    const typedStore = store as unknown as SignalState<State>;

    // Batch update - update multiple signals at once
    lattice.batch(() => {
      // Get current state from all signals
      const currentState = {} as State;
      (Object.keys(typedStore) as (keyof State)[]).forEach((key) => {
        currentState[key] = typedStore[key].value;
      });

      // Calculate new state
      const newState =
        typeof updates === 'function'
          ? (updates as unknown as (current: State) => Partial<State>)(currentState)
          : updates as unknown as Partial<State>;

      // Update each changed signal
      (
        Object.entries(newState) as [keyof State, State[keyof State]][]
      ).forEach(([key, value]) => {
        if (key in typedStore && !Object.is(typedStore[key].value, value)) {
          typedStore[key].value = value;
        }
      });
    });
  };

  // Create component context with merged functionality
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    effect: lattice.effect,
    batch: lattice.batch,
    set,
  };

  return context;
}
