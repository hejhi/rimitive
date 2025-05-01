/**
 * Lattice Core
 *
 * This module provides the core functionality for the Lattice component framework,
 * including store synchronization, API creation, and hooks system.
 */

// Re-export all core functionality
export { withStoreSync } from './withStoreSync';
export { createAPI } from './createAPI';
export { createHooks } from './createHooks';
export { createProps } from './createProps';
export { withLattice } from './withLattice';
export { mergeProps } from './mergeProps';
export { createLattice } from './createLattice';
export { withProps } from './withProps';

// Re-export types
export * from './types';
export * from './createLattice';
