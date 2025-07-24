/**
 * @fileoverview Types for Lattice framework integration and context management
 */

import type {
  Signal,
  Computed,
  EffectDisposer,
  Unsubscribe,
} from './types';

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
  subscribe: (source: Signal<unknown> | Computed<unknown>, callback: () => void) => Unsubscribe;
  dispose(): void;
}

/**
 * Partial lattice context for tree-shakeable builds
 * Only includes the methods that were configured
 */
export type PartialLatticeContext = Partial<Omit<LatticeContext, 'dispose'>> & {
  dispose(): void;
};