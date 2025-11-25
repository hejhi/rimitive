/**
 * Island-aware Client Preset
 *
 * Pre-configured API for client-side hydration with island support.
 * Uses the browser DOM renderer for real DOM manipulation.
 *
 * This is a deferred factory - call it when you need the service.
 * Pass signals to share reactive state with other parts of your app (e.g., router).
 */

import { composeFrom } from '@lattice/lattice';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import {
  createDOMRenderer,
  type DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import type { RefSpec } from '@lattice/view/types';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

/**
 * Create an island-aware client API
 *
 * Deferred factory for client-side hydration with island support.
 * Follows the same pattern as other service factories in the codebase.
 *
 * @param signals - Optional signals API to share reactive state (e.g., with router)
 */
export const createIslandClientApi = (signals = createSignalsApi()) => {
  const renderer = createDOMRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signals);
  const baseExtensions = defaultViewExtensions<DOMRendererConfig>();
  const views = composeFrom(baseExtensions, viewHelpers);

  const svc = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(signals.batch),
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

export type IslandClientService = ReturnType<typeof createIslandClientApi>;
export type IslandClientSvc = IslandClientService['svc'];
export type IslandClientViews = IslandClientService['service']['views'];
