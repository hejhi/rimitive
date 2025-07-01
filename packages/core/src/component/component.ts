/**
 * @fileoverview Component-scoped Lattice implementation
 *
 * Provides component factories that receive scoped lattice contexts,
 * enabling proper composition and isolation between component trees.
 */

import type {
  ComponentContext,
  SetState,
  SignalState,
  Signal,
  ComponentMiddleware,
} from './types';
import { createLatticeContext } from './context';
import { type StoreAdapter } from '../adapters/contract';
import { updateSignalValue, isDerivedSignal } from '../core/signal';
import {
  applyUpdate,
  handleDerivedSignalUpdate,
  findSignalStateKey,
} from './state-updates';

/**
 * Helper for creating partial updates with structural sharing
 * Re-exported from runtime for convenience
 */
export function partial<T extends Record<string, any>>(
  key: keyof T,
  value: any
): Partial<T> {
  return { [key]: value } as Partial<T>;
}

/**
 * Creates a component context from a store adapter
 */
export function createComponent<State extends Record<string, any>>(
  adapter: StoreAdapter<State>,
  enhancer?: ComponentMiddleware<State>
): ComponentContext<State> {
  // Create scoped lattice context
  const lattice = createLatticeContext();

  // Create signals that mirror adapter state
  const state = adapter.getState();
  const stateSignals = {} as SignalState<State>;

  // Initialize signals for all state keys
  type StateKey = Extract<keyof State, string>;

  (Object.keys(state) as StateKey[]).forEach((key) => {
    stateSignals[key] = lattice.signal(state[key]);
  });

  // Subscribe to adapter changes
  adapter.subscribe(() => {
    lattice._batch(() => {
      const newState = adapter.getState();

      // Update signals with new state
      (Object.keys(newState) as StateKey[]).forEach((key) => {
        const newVal = newState[key];
        const existingSig = stateSignals[key];

        if (existingSig) {
          if (!Object.is(existingSig(), newVal)) {
            // Update the signal directly
            updateSignalValue(existingSig, newVal, lattice._batching);
          }
          return;
        }

        // Create new signal for new key
        stateSignals[key] = lattice.signal(newVal);
      });
    });
  });

  // Create set function that delegates to adapter
  const set: SetState = (signal: Signal<any>, updates: any) => {
    // Find which state key this signal belongs to
    const stateKey = findSignalStateKey(signal, stateSignals);

    if (!stateKey) throw new Error('Signal not found in store');

    // Handle derived signals specially
    if (isDerivedSignal(signal)) {
      const sourceSignal = stateSignals[stateKey as keyof State];
      const sourceValue = sourceSignal();
      const result = handleDerivedSignalUpdate(signal, sourceValue, updates);

      if (result) {
        adapter.setState({ [stateKey]: result.value } as Partial<State>);
        return;
      }
    }

    // Regular signal update
    const newValue = applyUpdate(signal(), updates);

    // Update through adapter
    adapter.setState({ [stateKey]: newValue } as Partial<State>);
  };

  // Create component context with merged functionality
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: lattice.signal,
    computed: lattice.computed,
    set,
  };

  return enhancer ? enhancer(context) : context;
}
