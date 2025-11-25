/**
 * Island-aware Client Preset
 *
 * Pre-configured API for client-side hydration with island support.
 * Uses the browser DOM renderer for real DOM manipulation.
 */

import { composeFrom } from '@lattice/lattice';
import {
  defaultExtensions,
  defaultHelpers,
} from '@lattice/view/presets/core';
import {
  createDOMRenderer,
  type DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import type { RefSpec } from '@lattice/view/types';
import { createSignalsApi } from '@lattice/signals/presets/core';

/**
 * Create an island-aware client API
 *
 * Pre-configured API for client-side hydration with island support.
 * Provides the same API surface as the SSR preset but for browser rendering.
 */
export const createIslandClientApi = (signals = createSignalsApi()) => {
  const renderer = createDOMRenderer();
  const viewHelpers = defaultHelpers(renderer, signals);
  const views = composeFrom(
    defaultExtensions<DOMRendererConfig>(),
    viewHelpers
  );

  const api = {
    ...signals,
    ...views,
  };

  type ApiType = typeof api;

  return {
    api,
    signals,
    views,
    renderer,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(api),
    create: <TReturn>(fn: (api: ApiType) => TReturn): TReturn => fn(api),
  };
};

export type IslandClientApi = ReturnType<typeof createIslandClientApi>['api'];
export type IslandClientViews = ReturnType<typeof createIslandClientApi>['views'];
