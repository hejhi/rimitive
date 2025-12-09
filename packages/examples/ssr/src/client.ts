/**
 * Client-side Hydration - Module Composition Pattern
 *
 * Demonstrates client-side island hydration using the module composition pattern.
 * The hydrator creates per-island services with hydrating adapters.
 */
import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import {
  createDOMAdapter,
  type DOMAdapterConfig,
} from '@lattice/view/adapters/dom';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import { MountModule } from '@lattice/view/deps/mount';
import { OnModule } from '@lattice/view/deps/addEventListener';
import { createScopes } from '@lattice/view/deps/scope';
import type { Adapter } from '@lattice/view/types';
import { createDOMHydrator } from '@lattice/islands/hydrators/dom';

import { Counter } from './islands/Counter.js';
import { TodoList } from './islands/TodoList.js';
import { TagList } from './islands/TagList.js';

// Create main DOM adapter for post-hydration rendering
const domAdapter = createDOMAdapter();

// Compose main client service
const use = compose(
  // Signals
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  // View (adapter-bound)
  createElModule(domAdapter),
  createMapModule(domAdapter),
  createMatchModule(domAdapter),
  // Helpers
  MountModule,
  OnModule
);

const mainSvc = use();

// Service factory for hydrator - creates per-island service with hydrating adapter
const createSvc = (islandAdapter: Adapter<DOMAdapterConfig>) => {
  // Compose island-specific service with the hydrating adapter
  const islandUse = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    createElModule(islandAdapter),
    createMapModule(islandAdapter),
    createMatchModule(islandAdapter),
    OnModule
  );

  const islandSvc = islandUse();
  const scopes = createScopes({ baseEffect: islandSvc.effect });

  return {
    svc: islandSvc,
    createElementScope: scopes.createElementScope,
  };
};

// Mount function for client-side fallback rendering
const mount = (spec: {
  create: (svc: typeof mainSvc) => { element: unknown };
}) => ({
  element: spec.create(mainSvc),
});

// Create hydrator
const hydrator = createDOMHydrator(createSvc, mount);

// Hydrate islands
hydrator.hydrate(Counter, TodoList, TagList);
