/**
 * @fileoverview Svelte adapter for Lattice
 *
 * Provides an optimized native Svelte adapter that combines:
 * - High performance with Map-based listeners and pre-allocated arrays
 * - Full Svelte idioms (both subscription patterns)
 * - Comprehensive error handling
 */

export { createSvelteAdapter, type AdapterOptions } from './svelte-adapter';
export type { StoreAdapter } from '@lattice/core';
