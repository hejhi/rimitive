/**
 * @fileoverview Svelte adapter for Lattice
 *
 * Provides integration with Svelte 5 using the adapter-first API.
 */

export { createStore } from './svelte-adapter';
export { derived, deriveValues, useSlice } from './svelte-runtime.svelte';
