/**
 * Lattice Core - State-agnostic headless component framework
 *
 * This is the main entry point for the Lattice core library, providing
 * framework and store-agnostic APIs for creating and composing components.
 */

// Core factory functions
export { createModel } from './model';
export { createSelectors } from './selectors';
export { createActions } from './actions';
export { createView } from './view';
export { createComponent, instantiateComponent } from './lattice/create';

// Composition APIs
export { withComponent, extendComponent } from './lattice/compose';

// State Adapter APIs (new pluggable architecture)
export {
  // Core adapter interfaces and utilities
  stateAdapterRegistry,
  isStateAdapter,
  isStateStore,
  registerCommonAdapters,
  getAdapter,
  
  // Adapter implementations
  CustomStateAdapter,
  createCustomAdapter,
  customAdapter,
  ZustandStateAdapter,
  createZustandAdapter,
  zustandAdapter,
  zustandAdapterWithDevtools,
  createZustandAdapterWithImmer,
  
  // Enhanced component creation with adapters
  createComponentWithAdapter,
  createComponentWithCustomAdapter,
  createComponentWithNamedAdapter,
  withAdapter,
} from './adapters';

export type {
  // Adapter types
  StateAdapter,
  StateStore,
  StateAdapterWithMiddleware,
  StateAdapterFactory,
  StateAdapterRegistry,
  CustomAdapterConfig,
  ZustandAdapterConfig,
  ComponentWithAdapterConfig,
} from './adapters';

// Type utilities
export {
  // Brand symbols
  MODEL_FACTORY_BRAND,
  SELECTORS_FACTORY_BRAND,
  ACTIONS_FACTORY_BRAND,
  VIEW_FACTORY_BRAND,
  COMPONENT_FACTORY_BRAND,
  COMPONENT_FACTORY_INSTANCE_BRAND,
  LATTICE_BRAND,

  // Types
  Branded,
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
  ComponentFactoryInstance,
  Lattice,
  LatticeLike,
  ComponentFactory,
  ComponentConfig,
  ComponentExtension,
} from './shared/types';

// Type guards and utilities
export {
  isModelFactory,
  isSelectorsFactory,
  isActionsFactory,
  isViewFactory,
  brandWithSymbol,
} from './shared/identify';
