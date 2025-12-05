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

import { createSignalsSvc, type SignalsSvc } from '@lattice/signals/presets/core';
import { createViewSvc } from '@lattice/view/presets/core';
import { createScopes, type CreateScopes } from '@lattice/view/helpers/scope';
import {
  createDOMAdapter,
  type DOMAdapterConfig,
} from '@lattice/view/adapters/dom';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import type { RefSpec, Adapter } from '@lattice/view/types';
import { createDOMHydrator } from '../hydrators/dom';
import { ISLAND_META } from '../types';

export type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

type IslandComponent = { [ISLAND_META]?: unknown };

type ViewSvc = ReturnType<typeof createViewSvc<DOMAdapterConfig, SignalsSvc>>;

/**
 * Islands client app type
 */
export type IslandsClientApp = SignalsSvc &
  ViewSvc & {
    on: ReturnType<typeof createAddEventListener>;
    mount: <TElement>(spec: RefSpec<TElement>) => ReturnType<RefSpec<TElement>['create']>;
    hydrate: (...islands: IslandComponent[]) => void;
  };

/**
 * Create a fully-configured islands client app
 *
 * Batteries-included preset that creates signals, view, and hydration.
 *
 * @example
 * ```typescript
 * import { createIslandsClientApp } from '@lattice/islands/presets/islands.client';
 * import { Counter } from './islands/Counter';
 * import { TodoList } from './islands/TodoList';
 *
 * const { hydrate } = createIslandsClientApp();
 *
 * hydrate(Counter, TodoList);
 * ```
 */
export function createIslandsClientApp(): IslandsClientApp {
  const signalsSvc = createSignalsSvc();

  // Create DOM adapter for post-hydration rendering
  const domAdapter = createDOMAdapter();
  const viewSvc = createViewSvc(domAdapter, signalsSvc);

  const on = createAddEventListener(signalsSvc.batch);

  const svc = { ...signalsSvc, ...viewSvc, on };

  const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);

  // API factory for hydrator - receives adapter created by hydrator per-island
  const createSvc = (
    islandAdapter: Adapter<DOMAdapterConfig>,
    islandSignals: SignalsSvc
  ): { svc: SignalsSvc & ViewSvc & { on: ReturnType<typeof createAddEventListener> }; createElementScope: CreateScopes['createElementScope'] } => {
    const scopes = createScopes({ baseEffect: islandSignals.effect });
    const islandViews = createViewSvc(islandAdapter, islandSignals);
    return {
      svc: {
        ...islandSignals,
        ...islandViews,
        on: createAddEventListener(islandSignals.batch),
      },
      createElementScope: scopes.createElementScope,
    };
  };

  const hydrator = createDOMHydrator(createSvc, signalsSvc, (spec) => ({
    element: mount(spec),
  }));

  const hydrate = (...islands: IslandComponent[]): void =>
    hydrator.hydrate(...islands);

  return { ...svc, mount, hydrate };
}

/**
 * Island Svc type - the service type available to island components
 * Same as server's IslandSvc - islands work identically on both sides
 */
export type IslandSvc = SignalsSvc & ViewSvc;
