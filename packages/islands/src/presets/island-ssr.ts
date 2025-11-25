/**
 * Island-aware SSR Preset
 *
 * Pre-configured API for server-side rendering with island support.
 * Uses the island-aware linkedom renderer that automatically decorates
 * island fragments with hydration markers.
 */

import { composeFrom } from '@lattice/lattice';
import { defaultExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '../renderers/dom-server';
import type { RefSpec } from '@lattice/view/types';
import { createSignalsApi } from '@lattice/signals/presets/core';

/**
 * Create an island-aware SSR API
 *
 * Pre-configured API for server-side rendering with island support.
 * Provides the same API surface as the browser preset but optimized for SSR.
 */
export const createIslandSSRApi = (signals = createSignalsApi()) => {
  const renderer = createDOMServerRenderer();
  const viewHelpers = createSpec(renderer, signals);
  const views = composeFrom(
    defaultExtensions<DOMServerRendererConfig>(),
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

export type IslandSSRApi = ReturnType<typeof createIslandSSRApi>['api'];
export type IslandSSRViews = ReturnType<typeof createIslandSSRApi>['views'];
