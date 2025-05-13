/**
 * @module lattice
 * 
 * The lattice module provides the core functionality for creating and composing
 * lattices - the primary component system in the framework. A lattice is both
 * the declarative contract and the actual API for a component, defining and
 * enforcing the API surface at both type and runtime levels.
 * 
 * Lattices serve as the fundamental unit of composition, encapsulating models, 
 * actions, state, and views. They follow the SAM (State-Action-Model) pattern
 * with a fluent composition API for building complex, composable components.
 */

// Core types and brands
export * from './types';

// Type guards for runtime validation
export * from './identify';

// Creation functionality
export * from './create';

// Composition functionality
export * from './compose';

// Runtime tools and utilities
export * from './tools';

// Validation helpers
export * from './validate';