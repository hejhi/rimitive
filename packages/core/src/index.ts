/**
 * Lattice Core - Framework-agnostic headless component framework
 *
 * This is the main entry point for the Lattice core library, providing
 * clean APIs for creating and composing components with pluggable state management.
 */

// Core factory functions
export { createModel } from './model';
export { createSelectors } from './selectors';
export { createActions } from './actions';
export { createView } from './view';
export { createComponent, instantiateComponent } from './lattice/create';

// Composition APIs
export { withComponent, extendComponent } from './lattice/compose';

// Component creation with state adapters
// export { createComponentWithAdapter } from './lattice/create-with-adapter';

// State adapter interfaces
export type {
  StateAdapter,
  StateStore,
  StateAdapterWithMiddleware,
  StateAdapterFactory,
} from './shared/state-adapter';

export {
  isStateAdapter,
  isStateStore,
} from './shared/state-adapter';

// Core types
export type {
  // Brand symbols
  Branded,
  
  // Factory types
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
  ComponentFactory,
  ComponentFactoryInstance,
  
  // Component types
  Lattice,
  LatticeLike,
  ComponentConfig,
  ComponentExtension,
  
  // Factory parameters
  ModelFactoryParams,
  SelectorsFactoryParams,
  ActionsFactoryParams,
  ViewFactoryParams,
  
  // Slice factory types
  ModelSliceFactory,
  SelectorsSliceFactory,
  ActionsSliceFactory,
  ViewSliceFactory,
  
  // State management types
  SetState,
  GetState,
} from './shared/types';

// Brand symbols
export {
  MODEL_FACTORY_BRAND,
  SELECTORS_FACTORY_BRAND,
  ACTIONS_FACTORY_BRAND,
  VIEW_FACTORY_BRAND,
  COMPONENT_FACTORY_BRAND,
  COMPONENT_FACTORY_INSTANCE_BRAND,
  LATTICE_BRAND,
} from './shared/types';

// Type guards and utilities
export {
  isModelFactory,
  isSelectorsFactory,
  isActionsFactory,
  isViewFactory,
  brandWithSymbol,
} from './shared/identify';

// Composition utilities
export { from } from './shared/from';