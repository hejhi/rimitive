// Runtime package main entry point
// Framework-specific exports are available via subpath exports:
// - @lattice/runtime/react
// - @lattice/runtime/vue  
// - @lattice/runtime/svelte

// Re-export core utilities that are framework-agnostic
export { createLatticeStore } from '@lattice/core';

// Type exports that might be useful across frameworks
export type { ComponentFactory, RuntimeSliceFactory } from '@lattice/core';