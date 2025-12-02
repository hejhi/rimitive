/**
 * Island Client Preset
 *
 * Exports island-specific client adapters for hydration.
 * - createDOMHydrationAdapter: Walks existing DOM during hydration
 * - createIslandsAdapter: Switches from hydration to regular rendering
 */

export {
  createDOMHydrationAdapter,
  type DOMAdapterConfig,
  HydrationMismatch,
} from '../adapters/dom-hydration';

export { createIslandsAdapter } from '../adapters/islands';
