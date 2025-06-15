// Minimal Lattice Core - Just the essentials for smallest bundle size
// This is what you'd import for the most basic state management

// Only export the bare minimum needed for basic state management
export { compose } from './compose';
export { createStore, type StoreTools, type StoreSliceFactory } from './store';

// Re-export only essential types
export type { StoreAdapter, AdapterFactory } from './adapter-contract';