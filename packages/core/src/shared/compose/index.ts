/**
 * Export composition utilities for Lattice.
 * Provides the fluent API for composition with .with() method.
 */

// Fluent API (the only public API for composition)
export { compose } from './fluent';

// Internal type helper needed for compose implementation
export { InferExtension } from './core';
