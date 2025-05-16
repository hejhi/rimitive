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

// Composition APIs
export { compose } from './shared/compose/fluent';

// Type utilities
export {
  // Brand symbols 
  MODEL_FACTORY_BRAND,
  SELECTORS_FACTORY_BRAND,
  ACTIONS_FACTORY_BRAND,
  VIEW_FACTORY_BRAND,
  MODEL_INSTANCE_BRAND,
  SELECTORS_INSTANCE_BRAND,
  ACTIONS_INSTANCE_BRAND,
  VIEW_INSTANCE_BRAND,
  LATTICE_BRAND,
  
  // Types
  Branded,
  ModelInstance,
  SelectorsInstance,
  ActionsInstance,
  ViewInstance,
  Selectors,
  Model,
  Actions,
  View,
  Lattice,
  LatticeLike,
} from './shared/types';

// Type guards and utilities
export {
  isModelInstance,
  isSelectorsInstance,
  isActionInstance,
  isViewInstance,
  isModelFactory,
  isSelectorsFactory,
  isActionsFactory,
  isViewFactory,
  isLattice,
  brandWithSymbol,
} from './shared/identify';