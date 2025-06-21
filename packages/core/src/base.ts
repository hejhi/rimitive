// Minimal Lattice Core - Just the essentials for tree-shakeable imports
// This is what you'd import for the most basic state management

// Export runtime for adapter-based stores
export { createLatticeStore } from './runtime';

// Re-export essential types
export type { StoreAdapter, AdapterFactory } from './adapter-contract';
export type { ReactiveSliceFactory, SliceHandle } from './runtime-types';