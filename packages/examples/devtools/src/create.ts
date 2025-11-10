/**
 * App-level component factory
 *
 * All components in this app use this shared create function.
 * This ensures consistent renderer configuration across the entire app.
 */

import { createRenderer } from '@lattice/view/component';
import { createDOMRenderer } from '@lattice/view/renderers/dom';

const renderer = createDOMRenderer();

/**
 * DOM-specific component factory for this app
 * Types are automatically inferred from the renderer
 */
export const create = createRenderer(renderer);
