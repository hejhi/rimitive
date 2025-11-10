/**
 * App-level API
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */

import { createApi } from '@lattice/view/presets/core';
import { createDOMRenderer } from '@lattice/view/renderers/dom';

const renderer = createDOMRenderer();

/**
 * DOM-specific API for this app
 * Types are automatically inferred from the renderer
 */
export const { api, create, mount } = createApi(renderer);
