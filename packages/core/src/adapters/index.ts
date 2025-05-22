/**
 * State Adapters for Lattice Components
 *
 * This module exports all available state adapters that can be used
 * with Lattice components for pluggable state management.
 */

import { ComponentWithAdapterConfig } from '../lattice/create-with-adapter';
import { StateAdapter } from '../shared/state-adapter';

// Core adapter interfaces
export type {
  StateAdapter,
  StateStore,
  StateAdapterWithMiddleware,
  StateAdapterFactory,
  StateAdapterRegistry,
} from '../shared/state-adapter';

export {
  stateAdapterRegistry,
  isStateAdapter,
  isStateStore,
} from '../shared/state-adapter';

// Custom adapter (no external dependencies)
export {
  CustomStateAdapter,
  createCustomAdapter,
  customAdapter,
} from './custom';
export type { CustomAdapterConfig } from './custom';

// Zustand adapter
export {
  ZustandStateAdapter,
  createZustandAdapter,
  zustandAdapter,
  zustandAdapterWithDevtools,
  createZustandAdapterWithImmer,
} from './zustand';
export type { ZustandAdapterConfig } from './zustand';

// Enhanced component creation with adapters
export {
  createComponentWithAdapter,
  createComponentWithCustomAdapter,
  withAdapter,
} from '../lattice/create-with-adapter';
export type { ComponentWithAdapterConfig } from '../lattice/create-with-adapter';

/**
 * Convenience function to register commonly used adapters
 * This can be called at application startup to make adapters available globally
 */
export function registerCommonAdapters(): void {
  // Import to ensure they're available when needed
  const { stateAdapterRegistry } = require('../shared/state-adapter');
  const { customAdapter } = require('./custom');
  const { zustandAdapter, zustandAdapterWithDevtools } = require('./zustand');

  stateAdapterRegistry.register('custom', customAdapter);
  stateAdapterRegistry.register('zustand', zustandAdapter);
  stateAdapterRegistry.register('zustand-devtools', zustandAdapterWithDevtools);
}

/**
 * Get an adapter by name from the registry
 * Throws an error if the adapter is not found
 */
export function getAdapter<T>(name: string): StateAdapter<T> {
  const { stateAdapterRegistry } = require('../shared/state-adapter');
  const adapter = stateAdapterRegistry.get<T>(name);
  if (!adapter) {
    throw new Error(
      `State adapter '${name}' not found. Available adapters: ${stateAdapterRegistry.list().join(', ')}`
    );
  }
  return adapter;
}

/**
 * Create a component with a named adapter from the registry
 * This provides a convenient way to use registered adapters
 */
export function createComponentWithNamedAdapter<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  config: Omit<
    ComponentWithAdapterConfig<TModel, TSelectors, TActions, TViews>,
    'adapter'
  > & {
    adapterName: string;
  }
): any {
  const {
    createComponentWithAdapter,
  } = require('../lattice/create-with-adapter');

  return createComponentWithAdapter({
    ...config,
    adapter: getAdapter<TModel>(config.adapterName),
  });
}
