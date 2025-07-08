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
  // Create a WeakMap to store signal -> key mappings for O(1) lookup
  const signalToKeyMap = new WeakMap<Signal<unknown>, keyof State>();

  // Create scoped lattice context
  const ctx = createLatticeContext();

  // Create signals for state
  const stateSignals = {} as SignalState<State>;

  for (const [key, state] of Object.entries(initialState) as [
    keyof State,
    State[keyof State],
  ][]) {
    signalToKeyMap.set((stateSignals[key] = ctx.signal(state)), key);
  }

  // Create set function for batch updates only
  const set: SetState = <S>(
    store: SignalState<S>,
    updates: Partial<S> | ((current: S) => Partial<S>)
  ): void => {
    type SKey = keyof S;
    type State = S[SKey];

    ctx.batch(() => {
      // Get current state from all signals
      const currentState = {} as S;

      for (const [key, state] of Object.entries(store) as [
        SKey,
        Signal<State>,
      ][]) {
        currentState[key] = state.value;
      }

      // Calculate new state
      const newState =
        typeof updates === 'function' ? updates(currentState) : updates;

      for (const [key, value] of Object.entries(newState) as [SKey, State][]) {
        if (key in store && !Object.is(store[key].value, value)) {
          store[key].value = value;
        }
      }
    });
  };

  return {
    ...ctx,
    store: stateSignals,
    set,
  };
}
