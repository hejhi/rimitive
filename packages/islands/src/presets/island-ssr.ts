/**
 * Island SSR Preset
 *
 * Exports the island-aware SSR renderer for server-side rendering.
 * Compose with @lattice/signals and @lattice/view presets as needed.
 */

export {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '../renderers/dom-server';
