/**
 * Core State Adapter Interface for Lattice Components
 * 
 * This defines the minimal contract that any state management solution must implement
 * to work with Lattice components. It provides complete type safety without any `any` casts.
 */

import type { SetState, GetState } from './types';

/**
 * The store instance that provides the { set, get } interface
 * This is what gets passed to component model factories
 */
export interface StateStore<T> {
  /**
   * Get the current state
   */
  get: GetState<T>;
  
  /**
   * Update the state
   */
  set: SetState<T>;
  
  /**
   * Subscribe to state changes (optional for reactive systems)
   */
  subscribe?: (listener: (state: T) => void) => () => void;
  
  /**
   * Clean up resources (optional for memory management)
   */
  destroy?: () => void;
}

/**
 * Core interface that all state adapters must implement
 * Provides type-safe state store creation
 */
export interface StateAdapter<T> {
  /**
   * Creates a new state store instance for the given initial state
   * Returns the tools needed by Lattice components: { set, get }
   */
  createStore(initialState: T): StateStore<T>;
}

/**
 * Enhanced adapter interface that supports middleware composition
 * TMiddleware is adapter-specific (e.g., Zustand middleware vs Redux middleware)
 */
export interface StateAdapterWithMiddleware<T, TMiddleware> 
  extends StateAdapter<T> {
  /**
   * Creates a store with the specified middleware stack
   * Middleware stacks are adapter-specific and type-safe
   */
  createStoreWithMiddleware(
    initialState: T, 
    middleware: TMiddleware[]
  ): StateStore<T>;
}

/**
 * Factory function signature for creating configurable state adapters
 */
export type StateAdapterFactory<T, TConfig = Record<string, unknown>> = (
  config?: TConfig
) => StateAdapter<T>;

/**
 * Type guard to check if an object implements StateAdapter
 */
export function isStateAdapter<T>(obj: unknown): obj is StateAdapter<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'createStore' in obj &&
    typeof (obj as StateAdapter<T>).createStore === 'function'
  );
}

/**
 * Type guard to check if an object implements StateStore
 */
export function isStateStore<T>(obj: unknown): obj is StateStore<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'get' in obj &&
    'set' in obj &&
    typeof (obj as StateStore<T>).get === 'function' &&
    typeof (obj as StateStore<T>).set === 'function'
  );
}