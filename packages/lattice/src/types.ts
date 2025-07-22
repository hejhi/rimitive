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
 * Full lattice context with all features
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

/**
 * Partial lattice context for tree-shakeable builds
 * Only includes the methods that were configured
 */
export type PartialLatticeContext = Partial<Omit<LatticeContext, 'dispose'>> & {
  dispose(): void;
};

