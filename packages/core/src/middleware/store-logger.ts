/**
 * @fileoverview Store logger middleware - logs all store state changes
 */

import type { Store } from '../store';

/**
 * Wraps a store to log all state changes
 */
export function withStoreLogger<T extends object>(store: Store<T>): Store<T> {
  const originalSet = store.set;

  // Wrap set to log changes
  const enhancedSet = (updates: Parameters<typeof originalSet>[0]) => {
    // Get current state before update
    const stateBefore: Record<string, unknown> = {};
    for (const key in store.state) {
      stateBefore[key] = store.state[key].value;
    }

    // Call original set
    originalSet(updates);

    // Get state after update
    const stateAfter: Record<string, unknown> = {};
    const changedKeys: string[] = [];

    for (const key in store.state) {
      stateAfter[key] = store.state[key].value;
      if (stateBefore[key] !== stateAfter[key]) {
        changedKeys.push(key);
      }
    }

    // Log only changed values
    const changes: Record<string, unknown> = {};
    for (const key of changedKeys) {
      changes[key] = stateAfter[key];
    }

    if (Object.keys(changes).length > 0) {
      console.log('[Store Logger] State update:', changes);
    }
  };

  // Return enhanced store
  return {
    ...store,
    set: enhancedSet
  };
}