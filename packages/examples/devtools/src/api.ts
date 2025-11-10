/**
 * App-level component factory
 *
 * All components in this app use this shared create function.
 * This ensures consistent renderer configuration across the entire app.
 */
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createApi } from '@lattice/view/presets/core';

// Create a renderer-specific API with pre-typed create function
const renderer = createDOMRenderer();

export const { create, deps, extensions } = createApi(renderer);