/**
 * createComponentWithAdapter - Bridge factory-time components to runtime state
 * 
 * This function implements the adapter pattern that allows components created with
 * factory-time models to be wired up to runtime state adapters.
 */

import type { ComponentFactory } from '../shared/types';

/**
 * Creates an adapter that bridges factory-time component definitions to runtime state.
 * 
 * @param componentFactory - A component factory created with factory-time models
 * @param runtimeConfig - Configuration that provides runtime state
 * @returns An adapted component that accesses runtime state
 */
export function createComponentWithAdapter<
  TModel = unknown,
  TSelectors = unknown, 
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  runtimeConfig: {
    model: any; // For now, accept any model type
  }
) {
  // Get the factory-time component structure
  const factoryComponent = componentFactory();
  
  // The key insight: we need to create new selectors that use runtimeConfig.model
  // instead of factoryComponent.model
  
  // Create bridged selectors that access runtime model instead of factory-time model
  const bridgedSelectors = createBridgedSelectors(
    factoryComponent.getSelectors(),
    runtimeConfig.model
  );
  
  // Create a bridged component that uses runtime state
  const bridgedComponent = {
    // Keep the original factory for reference
    originalFactory: componentFactory,
    factoryComponent,
    
    // Runtime configuration
    runtimeModel: runtimeConfig.model,
    
    // Bridged selectors that access runtime state
    bridgedSelectors,
  };
  
  return bridgedComponent;
}

/**
 * Creates new selectors that access runtime model instead of factory-time model
 */
function createBridgedSelectors(factorySelectors: any, runtimeModel: any) {
  // This is the core of the adapter pattern
  // We need to take the selector factory and rewire it to use runtimeModel
  
  // For now, return the structure without the actual bridging
  // The bridging logic needs more careful design
  return {
    factory: factorySelectors,
    runtime: runtimeModel,
    // TODO: Implement the actual selector bridging
    // The challenge is that factorySelectors is already a composed factory,
    // we need to extract and reapply the original selector factory function
  };
}