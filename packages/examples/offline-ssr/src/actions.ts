/**
 * Actions Module
 *
 * Provides data mutation actions with cache invalidation.
 * Pages access these via svc.actions instead of callback props.
 */

import { defineConfigurableModule } from '@rimitive/core';
import type { Remote } from 'comlink';
import type { WorkerApi } from './worker-api';
import type { TodoList } from './data';
import {
  createList,
  deleteList,
  createItem,
  toggleItem,
  deleteItem,
} from './data';

// =============================================================================
// Types
// =============================================================================

export type Actions = {
  createList: (name: string, color: string) => Promise<TodoList>;
  deleteList: (id: string) => Promise<void>;
  createItem: (listId: string, text: string) => Promise<void>;
  toggleItem: (listId: string, itemId: string) => Promise<void>;
  deleteItem: (listId: string, itemId: string) => Promise<void>;
};

// =============================================================================
// No-op Actions (for worker SSR)
// =============================================================================

export const noopActions: Actions = {
  createList: () =>
    Promise.resolve({ id: '', name: '', color: '', createdAt: 0 }),
  deleteList: () => Promise.resolve(),
  createItem: () => Promise.resolve(),
  toggleItem: () => Promise.resolve(),
  deleteItem: () => Promise.resolve(),
};

// =============================================================================
// Actions with Cache Invalidation
// =============================================================================

function createActions(workerApi: Remote<WorkerApi>): Actions {
  return {
    createList: async (name, color) => {
      const list = await createList(name, color);
      // Invalidate home page cache, pre-render new list page
      workerApi.invalidate('/');
      workerApi.prerender(`/list/${list.id}`);
      return list;
    },

    deleteList: async (id) => {
      await deleteList(id);
      workerApi.invalidate('/');
    },

    createItem: async (listId, text) => {
      await createItem(listId, text);
      workerApi.invalidate(`/list/${listId}`);
      workerApi.invalidate('/');
    },

    toggleItem: async (listId, itemId) => {
      await toggleItem(itemId);
      workerApi.invalidate(`/list/${listId}`);
      workerApi.invalidate('/');
    },

    deleteItem: async (listId, itemId) => {
      await deleteItem(itemId);
      workerApi.invalidate(`/list/${listId}`);
      workerApi.invalidate('/');
    },
  };
}

// =============================================================================
// Module
// =============================================================================

export type ActionsConfig = {
  workerApi?: Remote<WorkerApi>;
};

export const ActionsModule = defineConfigurableModule({
  name: 'actions' as const,
  dependencies: [],
  create: (_deps: object, config: ActionsConfig): Actions =>
    config.workerApi ? createActions(config.workerApi) : noopActions,
});
