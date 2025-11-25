/**
 * Island-aware SSR Preset
 *
 * Pre-configured API for server-side rendering with island support.
 * Uses the island-aware linkedom renderer that automatically decorates
 * island fragments with hydration markers.
 *
 * This is a deferred factory - call it per-request for fresh signals.
 */

import { composeFrom } from '@lattice/lattice';
import { defaultExtensions as defaultViewExtensions } from '@lattice/view/presets/core';
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
 * Deferred factory for server-side rendering with island support.
 * Call this per-request to get fresh signals (avoids state leakage).
 *
 * @param signals - Optional signals API (usually create fresh per-request)
 */
export const createIslandSSRApi = (signals = createSignalsApi()) => {
  const renderer = createDOMServerRenderer();
  const viewHelpers = createSpec(renderer, signals);
  const baseExtensions = defaultViewExtensions<DOMServerRendererConfig>();
  const views = composeFrom(baseExtensions, viewHelpers);

  const svc = {
    ...signals,
    ...views,
  };

  type Service = typeof svc;

  return {
    service: {
      views,
      signals,
    },
    svc,
    renderer,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
    useSvc: <TReturn>(fn: (svc: Service) => TReturn): TReturn => fn(svc),
  };
};

export type IslandSSRService = ReturnType<typeof createIslandSSRApi>;
export type IslandSSRSvc = IslandSSRService['svc'];
export type IslandSSRViews = IslandSSRService['service']['views'];
