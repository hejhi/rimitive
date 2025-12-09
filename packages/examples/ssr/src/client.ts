/**
 * Client-side Hydration
 *
 * Uses the shared composition with DOM adapter for hydration.
 */
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createScopes } from '@lattice/view/deps/scope';
import type { Adapter } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { createDOMHydrator } from '@lattice/islands/hydrators/dom';

import { createService, type Service } from './service.js';
import { Counter } from './islands/Counter.js';
import { TodoList } from './islands/TodoList.js';
import { TagList } from './islands/TagList.js';

// Create main DOM adapter and service
const domAdapter = createDOMAdapter();
const mainSvc = createService(domAdapter);

// Service factory for hydrator - creates per-island service with hydrating adapter
const createSvc = (islandAdapter: Adapter<DOMAdapterConfig>) => {
  const islandSvc = createService(islandAdapter);
  const scopes = createScopes({ baseEffect: islandSvc.effect });

  return {
    svc: islandSvc,
    createElementScope: scopes.createElementScope,
  };
};

// Mount function for client-side fallback rendering
const mount = (spec: { create: (svc: Service) => { element: unknown } }) => ({
  element: spec.create(mainSvc),
});

// Create hydrator and hydrate islands
const hydrator = createDOMHydrator(createSvc, mount);
hydrator.hydrate(Counter, TodoList, TagList);
