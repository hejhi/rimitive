/**
 * @fileoverview Lattice runtime - the core execution engine
 * 
 * The runtime is responsible for executing component specifications
 * using minimal adapters that only provide store primitives.
 */

import type { ComponentFactory, ComponentSpec, ModelTools } from './index';

/**
 * Minimal adapter interface - adapters only need to provide store primitives
 */
export interface StoreAdapter<Model> {
  getState: () => Model;
  setState: (updates: Partial<Model>) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Runtime result - what the runtime returns after executing a component
 */
export interface RuntimeResult<Model, Actions, Views> {
  actions: Actions;
  views: Views;
  subscribe: (listener: () => void) => () => void;
  getState: () => Model;
}

/**
 * Creates a Lattice store by combining a component with an adapter
 * 
 * The runtime handles:
 * - Model initialization
 * - Action execution (simple method selection)
 * - View execution (all views must be from resolve())
 * 
 * @param componentFactory - The component specification factory
 * @param adapter - Minimal store adapter providing get/set/subscribe
 * @returns Runtime result with actions, views, and subscribe
 */
export function createLatticeStore<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>,
  adapter: StoreAdapter<Model>
): RuntimeResult<Model, Actions, Views> {
  // Execute the component factory to get the specification
  const component = componentFactory();
  
  // Create model tools that use the adapter
  const modelTools: ModelTools<Model> = {
    get: adapter.getState,
    set: adapter.setState
  };
  
  // Initialize the model with the adapter's tools
  const initialState = component.model(modelTools);
  
  // Set the initial state in the adapter
  adapter.setState(initialState);
  
  // Execute the actions slice with a getter bound to the adapter
  const actions = component.actions(() => adapter.getState());
  
  // Views are already slice factories from resolve()
  // We need to execute each one with the getState function
  const views = {} as Views;
  
  for (const [key, viewSliceFactory] of Object.entries(component.views as Record<string, any>)) {
    // Each view is a SliceFactory that returns a function
    console.log(`[Runtime] Executing view slice factory for "${key}"`);
    const viewFunction = viewSliceFactory(() => adapter.getState());
    console.log(`[Runtime] View function type: ${typeof viewFunction}`);
    views[key as keyof Views] = viewFunction;
  }
  
  return {
    actions,
    views,
    subscribe: adapter.subscribe,
    getState: adapter.getState
  };
}

/**
 * Type guard to check if a value is a store adapter
 */
export function isStoreAdapter<Model>(value: unknown): value is StoreAdapter<Model> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getState' in value &&
    'setState' in value &&
    'subscribe' in value &&
    typeof (value as any).getState === 'function' &&
    typeof (value as any).setState === 'function' &&
    typeof (value as any).subscribe === 'function'
  );
}