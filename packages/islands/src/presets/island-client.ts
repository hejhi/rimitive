/**
 * Island Client Preset
 *
 * Exports island-specific client renderers for hydration.
 * - createDOMHydrationRenderer: Walks existing DOM during hydration
 * - createIslandsRenderer: Switches from hydration to regular rendering
 */

export {
  createDOMHydrationRenderer,
  type DOMRendererConfig,
  HydrationMismatch,
} from '../renderers/dom-hydration';

export { createIslandsRenderer } from '../renderers/islands';
