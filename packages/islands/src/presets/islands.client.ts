/**
 * Islands Client Preset
 *
 * Pre-configured bundle for client-side hydration of islands.
 * Combines signals, view primitives, and hydration helpers.
 *
 * @example
 * ```ts
 * import { createIslandsClientApp } from '@lattice/islands/presets/islands.client';
 * import { Counter } from './islands/Counter';
 * import { TodoList } from './islands/TodoList';
 *
 * const { hydrate } = createIslandsClientApp();
 *
 * hydrate(Counter, TodoList);
 * ```
 */

import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions, defaultHelpers } from '@lattice/view/presets/core';
import { createDOMAdapter, type DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import type { RefSpec, Adapter } from '@lattice/view/types';
import { createDOMHydrator } from '../hydrators/dom';
import { ISLAND_META } from '../types';

export type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

type IslandComponent = { [ISLAND_META]?: unknown };

/**
 * Create a fully-configured islands client app
 *
 * Batteries-included preset that creates signals, view, and hydration.
 * For custom composition, use `@lattice/islands/presets/core.client` instead.
 */
export const createIslandsClientApp = () => {
  const signalsSvc = createSignalsApi();

  // Create DOM adapter for post-hydration rendering
  const domAdapter = createDOMAdapter();
  const viewHelpers = defaultHelpers(domAdapter, signalsSvc);
  const viewSvc = composeFrom(defaultExtensions<DOMAdapterConfig>(), viewHelpers);

  const on = createAddEventListener(signalsSvc.batch);

  const svc = { ...signalsSvc, ...viewSvc, on };

  const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);

  // API factory for hydrator - receives adapter created by hydrator per-island
  const createApi = (
    islandAdapter: Adapter<DOMAdapterConfig>,
    islandSignals: ReturnType<typeof createSignalsApi>
  ) => {
    const helpers = defaultHelpers(islandAdapter, islandSignals);
    const islandViews = composeFrom(defaultExtensions<DOMAdapterConfig>(), helpers);
    return {
      api: { ...islandSignals, ...islandViews, on: createAddEventListener(islandSignals.batch) },
      createElementScope: helpers.createElementScope,
    };
  };

  const hydrator = createDOMHydrator(createApi, signalsSvc, (spec) => ({
    element: mount(spec),
  }));

  const hydrate = (...islands: IslandComponent[]) => hydrator.hydrate(...islands);

  return { ...svc, mount, hydrate };
};

export type IslandsClientApp = ReturnType<typeof createIslandsClientApp>;

/** @deprecated Use createIslandsClientApp instead */
export const createHydrateApp = createIslandsClientApp;

/** @deprecated Use IslandsClientApp instead */
export type HydrateApp = IslandsClientApp;

/** @deprecated Use IslandsClientApp instead */
export type HydrateSvc = IslandsClientApp;
