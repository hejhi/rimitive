/**
 * Export composition utilities for Lattice.
 * The functional composition API provides a cleaner, more type-friendly alternative
 * to the fluent API with .with() and .create() methods.
 */

// Core composition function
export { composeWith, InferExtension } from './core';

// Type-specific helpers
export { composeModel, composeModelTools } from './model';
export { composeState } from './state';
export { composeActions } from './actions';
export { composeView } from './view';

// Fluent API (recommended)
export { compose } from './fluent';

// Existing exports
export { use } from './use';
export { instantiate, isFinalized } from './instantiate';