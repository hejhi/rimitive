/**
 * Island-aware SSR Preset
 *
 * Pre-configured API for server-side rendering with island support.
 * Uses createSSRApi with the island-aware linkedom renderer.
 */

import { createSSRApi } from '@lattice/view/presets/ssr';
import { createLinkedomIslandRenderer } from '../renderers/linkedom-island';

/**
 * Create an island-aware SSR API
 *
 * Same as createSSRApi but uses the island-aware renderer that
 * automatically decorates island fragments with hydration markers.
 *
 * @param signals - Signals API (from @lattice/signals/presets/core)
 * @returns API object with el, map, match, mount, and island renderer
 */
export const createIslandSSRApi = (signals: {
  signal: <T>(value: T) => () => T;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
}): ReturnType<typeof createSSRApi> => {
  const renderer = createLinkedomIslandRenderer();
  return createSSRApi(signals, renderer);
};

export type IslandSSRApi = ReturnType<typeof createIslandSSRApi>['api'];
export type IslandSSRViews = ReturnType<typeof createIslandSSRApi>['views'];
