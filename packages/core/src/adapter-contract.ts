/**
 * @fileoverview Minimal adapter contract for Lattice framework
 *
 * This module defines the minimal interface that all Lattice adapters must implement.
 * Adapters are now just thin wrappers that provide store primitives.
 * All component execution is handled by the Lattice runtime.
 */

/**
 * Minimal adapter interface - adapters only need to provide store primitives
 *
 * The adapter's only responsibility is to bridge between Lattice and the
 * underlying state management system's get/set/subscribe primitives.
 */
export interface StoreAdapter<State> {
  /**
   * Get the current state
   */
  getState: () => State;

  /**
   * Update the state with partial updates
   */
  setState: (updates: Partial<State>) => void;

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribe: (listener: () => void) => () => void;
}

/**
 * Factory function that creates a store adapter with initial state
 *
 * This allows adapters that need initial state at creation time (e.g., for middleware)
 * to defer their creation until the initial state is known.
 */
export type AdapterFactory<State> = (
  initialState: State
) => StoreAdapter<State>;

/**
 * Type guard to check if a value is a store adapter
 */
export function isStoreAdapter<State>(
  value: unknown
): value is StoreAdapter<State> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getState' in value &&
    'setState' in value &&
    'subscribe' in value &&
    typeof value.getState === 'function' &&
    typeof value.setState === 'function' &&
    typeof value.subscribe === 'function'
  );
}

/**
 * Type guard to check if a value is an adapter factory
 */
export function isAdapterFactory<State>(
  value: unknown
): value is AdapterFactory<State> {
  return typeof value === 'function';
}
