/**
 * @fileoverview Runtime types for Lattice core
 *
 * Core-specific types for Lattice. Signal types should be imported from @lattice/signals directly.
 */

import type {
  Signal,
  Computed,
  EffectDisposer,
  Selected,
  Unsubscribe,
} from '@lattice/signals';

/**
 * State represented as signals - each property is a reactive signal
 */
export type SignalState<State> = {
  [K in keyof State]: Signal<State[K]>;
};

/**
 * Function to batch update state through signals
 * Updates multiple signals atomically within a single batch
 */
export interface SetState {
  <State>(
    store: SignalState<State>,
    updates: Partial<State> | ((current: State) => Partial<State>)
  ): void;
}

/**
 * Lattice context provides scoped signal/computed factories
 * Each component tree gets its own context to avoid global conflicts
 */
export interface LatticeContext {
  signal: <T>(initialValue: T, name?: string) => Signal<T>;
  computed: <T>(computeFn: () => T) => Computed<T>;
  effect: (effectFn: () => void | (() => void)) => EffectDisposer;
  batch: (fn: () => void) => void;
  select: <T, R>(source: Signal<T> | Computed<T> | Selected<T>, selector: (value: T) => R) => Selected<R>;
  subscribe: (source: Signal<unknown> | Computed<unknown> | Selected<unknown>, callback: () => void) => Unsubscribe;
  dispose(): void;
}

export interface StoreConfig<State> {
  state: State;
}

// Re-export store type from store module
export type { Store } from './store';
