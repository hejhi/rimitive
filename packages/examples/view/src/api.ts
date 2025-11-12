/**
 * App-level API
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { createApi, defaultExtensions } from '@lattice/view/presets/core';
import { createApi as createLatticeApi } from '@lattice/lattice';
import { defaultExtensions as defaultSignalsExtensions, defaultHelpers } from '@lattice/signals/presets/core';
import { createDOMRenderer } from '@lattice/view/renderers/dom';

const renderer = createDOMRenderer();

export const signals = createLatticeApi(defaultSignalsExtensions(), defaultHelpers());
export type Signals = typeof signals;

/**
 * DOM-specific API for this app
 * Types are automatically inferred from the renderer
 */
export const { api, create, mount } = createApi(renderer, defaultExtensions(), signals);
