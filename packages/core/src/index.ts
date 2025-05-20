/**
 * Lattice - A headless component framework built on Zustand
 *
 * This is the main entry point for the Lattice library, exporting
 * the core APIs for creating and composing components.
 */

// Core factory functions
export { createModel } from './model';
export { createSelectors } from './selectors';
export { createActions } from './actions';
export { createView } from './view';
export { createComponent, instantiateComponent } from './lattice/create';

// Composition APIs
export { withComponent, extendComponent } from './lattice/compose';

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
  isComponentFactoryInstance,
  isComponentFactory,
  isLattice,
  brandWithSymbol,
  isModelTools,
  isSelectorsTools,
  isActionsTools,
  isViewTools,
} from './shared/identify';
