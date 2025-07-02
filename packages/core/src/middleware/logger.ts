/**
 * @fileoverview Logger middleware - logs all state changes
 */

import type { ComponentContext, SetState } from '../component/types';

/**
 * Logger middleware - logs all state changes
 */
export function withLogger<State extends Record<string, unknown>>(
  context: ComponentContext<State>
): ComponentContext<State> {
  const originalSet = context.set;

  // Wrap set to log changes
  const enhancedSet: SetState = ((
    signal: Parameters<SetState>[0],
    updates?: Parameters<SetState>[1]
  ) => {
    // Get current state before update
    const stateBefore: Record<string, unknown> = {};
    for (const key in context.store) {
      stateBefore[key] = context.store[key]();
    }

    // Call original set
    originalSet(signal, updates);

    // Get state after update
    const stateAfter: Record<string, unknown> = {};
    const changedKeys: string[] = [];

    for (const key in context.store) {
      stateAfter[key] = context.store[key]();
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
      console.log('[Lattice Logger] State update:', changes);
    }
  }) as SetState;

  context.set = enhancedSet;

  return context;
}
