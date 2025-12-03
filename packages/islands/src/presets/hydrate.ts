/**
 * Hydration Preset
 *
 * Pre-configured bundle for client-side hydration of islands.
 * Combines signals, view primitives, and hydration helpers.
 *
 * @example
 * ```ts
 * import { createHydrateSvc } from '@lattice/islands/presets/hydrate';
 * import { Counter } from './islands/Counter';
 * import { TodoList } from './islands/TodoList';
 *
 * const { hydrate } = createHydrateSvc();
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
 * Create a fully-configured hydration service
 */
export const createHydrateSvc = () => {
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

export type HydrateSvc = ReturnType<typeof createHydrateSvc>;
