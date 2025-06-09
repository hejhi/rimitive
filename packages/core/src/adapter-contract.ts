/**
 * @fileoverview Minimal adapter contract for Lattice framework
 *
 * This module defines the minimal interface that adapters need to implement.
 * The runtime handles all the complexity of executing components.
 */

/**
 * Minimal adapter interface - adapters only need to provide store primitives
 * 
 * Adapters are responsible for:
 * - Managing state storage
 * - Providing state access
 * - Managing subscriptions
 * 
 * The Lattice runtime handles:
 * - Component execution
 * - View resolution
 * - Action binding
 */
export interface StoreAdapter<Model> {
  /**
   * Get the current state
   */
  getState: () => Model;
  
  /**
   * Update the state with partial updates
   */
  setState: (updates: Partial<Model>) => void;
  
  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribe: (listener: () => void) => () => void;
}

/**
 * Type helper to extract view function types from component views
 * 
 * All views must be created with resolve() and will be functions:
 * - Non-parameterized: () => Result
 * - Parameterized: (params) => Result
 */
export type ViewFunctionTypes<Views> = {
  [K in keyof Views]: Views[K] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : never;
};

/**
 * Result of adapter execution - what users interact with
 */
export interface AdapterResult<Model, Actions, Views> {
  /**
   * Actions object with all mutation methods
   */
  actions: Actions;
  
  /**
   * Views object with all view functions
   */
  views: ViewFunctionTypes<Views>;
  
  /**
   * Subscribe to state changes
   */
  subscribe: (listener: () => void) => () => void;
  
  /**
   * Get current state (for debugging/testing)
   */
  getState: () => Model;
  
  /**
   * Optional cleanup method
   */
  destroy?: () => void;
}

/**
 * Adapter factory function type
 * 
 * Adapters should use createLatticeStore from runtime:
 * ```typescript
 * export function createMyAdapter(component) {
 *   const adapter: StoreAdapter<Model> = {
 *     getState: () => myStore.getState(),
 *     setState: (updates) => myStore.setState(updates),
 *     subscribe: (listener) => myStore.subscribe(listener)
 *   };
 *   return createLatticeStore(component, adapter);
 * }
 * ```
 */
export type AdapterFactory = <Model, Actions, Views>(
  component: () => { model: any; actions: any; views: any }
) => AdapterResult<Model, Actions, Views>;