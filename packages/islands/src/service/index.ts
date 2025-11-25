/**
 * Service Module
 *
 * Re-exports the SSR service factory and types.
 * For client-side, use @lattice/islands/presets/island-client instead.
 */

export {
  createIslandSSRApi,
  type IslandSSRService,
  type IslandSSRSvc,
  type IslandSSRViews,
} from '../presets/island-ssr';
