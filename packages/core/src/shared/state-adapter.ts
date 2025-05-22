/**
 * State Adapter Interface for Lattice Components
 * 
 * This interface provides the minimal contract that any state management solution
 * must implement to work with Lattice components. It abstracts away the specific
 * implementation details while providing a consistent API surface.
 */

import type { SetState, GetState } from './types';

/**
 * Core interface that all state adapters must implement
 * This provides the minimal { set, get } contract that Lattice components expect
 */
export interface StateAdapter<T> {
  /**
   * Creates a new state store instance for the given initial state
   * Returns the tools needed by Lattice components: { set, get }
   */
  createStore(initialState: T): StateStore<T>;
}

/**
 * The store instance returned by StateAdapter.createStore()
 * This is what gets passed to component factories as ModelFactoryParams
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
   * Optional: Subscribe to state changes
   * This enables framework adapters to build reactive systems
   */
  subscribe?: (listener: (state: T) => void) => () => void;
  
  /**
   * Optional: Destroy the store and clean up resources
   * Useful for memory management in dynamic component scenarios
   */
  destroy?: () => void;
}

/**
 * Configuration for state adapters that support middleware
 * Allows adapters to accept middleware stacks for enhanced functionality
 */
export interface StateAdapterWithMiddleware<T, TMiddleware = unknown> 
  extends StateAdapter<T> {
  /**
   * Creates a store with the specified middleware stack
   * Middleware stacks are adapter-specific (e.g., Zustand middleware vs Redux middleware)
   */
  createStoreWithMiddleware(
    initialState: T, 
    middleware: TMiddleware[]
  ): StateStore<T>;
}

/**
 * Factory function signature for creating state adapters
 * This allows adapters to be configured before use
 */
export type StateAdapterFactory<T, TConfig = unknown> = (
  config?: TConfig
) => StateAdapter<T>;

/**
 * Registry for state adapters
 * Allows runtime selection of different state management strategies
 */
export interface StateAdapterRegistry {
  /**
   * Register a state adapter with a name
   */
  register<T>(name: string, adapter: StateAdapter<T>): void;
  
  /**
   * Get a registered state adapter by name
   */
  get<T>(name: string): StateAdapter<T> | undefined;
  
  /**
   * List all registered adapter names
   */
  list(): string[];
}

/**
 * Default registry instance
 * Components can use this for adapter selection if no specific adapter is provided
 */
export const stateAdapterRegistry: StateAdapterRegistry = {
  adapters: new Map(),
  
  register<T>(name: string, adapter: StateAdapter<T>) {
    (this.adapters as Map<string, StateAdapter<any>>).set(name, adapter);
  },
  
  get<T>(name: string): StateAdapter<T> | undefined {
    return (this.adapters as Map<string, StateAdapter<any>>).get(name);
  },
  
  list(): string[] {
    return Array.from((this.adapters as Map<string, StateAdapter<any>>).keys());
  }
} as StateAdapterRegistry & { adapters: Map<string, StateAdapter<any>> };

/**
 * Type guard to check if an object implements StateAdapter
 */
export function isStateAdapter<T>(obj: unknown): obj is StateAdapter<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'createStore' in obj &&
    typeof (obj as any).createStore === 'function'
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
    typeof (obj as any).get === 'function' &&
    typeof (obj as any).set === 'function'
  );
}