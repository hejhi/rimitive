/**
 * Islands Client Preset
 *
 * Pre-configured bundle for client-side hydration of islands.
 * Combines signals, view primitives, and hydration deps.
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

import { type SignalsSvc } from '@lattice/signals/presets/core';
import { createViewSvc, type ViewSvc } from '@lattice/view/presets/core';
import { createScopes, type CreateScopes } from '@lattice/view/deps/scope';
import {
  createDOMAdapter,
  type DOMAdapterConfig,
} from '@lattice/view/adapters/dom';
import { createAddEventListener } from '@lattice/view/deps/addEventListener';
import type { RefSpec, Adapter } from '@lattice/view/types';
import { createDOMHydrator } from '../hydrators/dom';
import { ISLAND_META } from '../types';

export type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

type IslandComponent = { [ISLAND_META]?: unknown };

type DomViewSvc = ViewSvc<DOMAdapterConfig>;

/**
 * Islands client app type
 */
export type IslandsClientApp = SignalsSvc &
  DomViewSvc & {
    on: ReturnType<typeof createAddEventListener>;
    mount: <TElement>(
      spec: RefSpec<TElement>
    ) => ReturnType<RefSpec<TElement>['create']>;
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
  // Create DOM adapter for post-hydration rendering
  const domAdapter = createDOMAdapter();
  const viewSvc = createViewSvc(domAdapter)();

  const on = createAddEventListener(viewSvc.batch);

  const svc = { ...viewSvc, on };

  const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);

  // API factory for hydrator - receives adapter created by hydrator per-island
  const createSvc = (
    islandAdapter: Adapter<DOMAdapterConfig>
  ): {
    svc: SignalsSvc &
      DomViewSvc & { on: ReturnType<typeof createAddEventListener> };
    createElementScope: CreateScopes['createElementScope'];
  } => {
    const islandViews = createViewSvc(islandAdapter)();
    const scopes = createScopes({ baseEffect: islandViews.effect });
    return {
      svc: {
        ...islandViews,
        on: createAddEventListener(islandViews.batch),
      },
      createElementScope: scopes.createElementScope,
    };
  };

  const hydrator = createDOMHydrator(createSvc, (spec) => ({
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
export type IslandSvc = SignalsSvc & DomViewSvc;
