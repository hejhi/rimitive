/**
 * @fileoverview Svelte adapter for Lattice
 *
 * Provides integration with Svelte 5 using the adapter-first API.
 */

// Export the class-based API
export { LatticeStore, createSliceFactory } from './svelte-adapter.svelte';
export type { AdapterOptions, StateFromStore } from './svelte-adapter.svelte';
