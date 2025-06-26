// Framework integrations package main entry point
// Framework-specific exports are available via subpath exports:
// - @lattice/frameworks/react
// - @lattice/frameworks/vue  
// - @lattice/frameworks/svelte

// Re-export core utilities that are framework-agnostic
export { createComponent, createStore, createStoreWithAdapter } from '@lattice/core';

// Type exports that might be useful across frameworks
export type { ComponentFactory, Signal, Computed, LatticeContext } from '@lattice/core';