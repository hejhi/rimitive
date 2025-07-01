/**
 * @fileoverview Persist middleware - saves state to localStorage
 */

import type { ComponentContext, StoreConfig } from '../component/types';

/**
 * Persist middleware - saves state to localStorage
 */
export function withPersistence<State extends Record<string, any>>(
  state: State,
  key: string
): StoreConfig<State> {
  return {
    state,
    enhancer: (context: ComponentContext<State>) => {
      // Try to load initial state from localStorage
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Update initial state - set each property individually
          for (const prop in parsed) {
            if (prop in context.store) {
              context.set(context.store[prop as keyof State], parsed[prop]);
            }
          }
        } catch (e) {
          console.warn(
            `[Lattice Persist] Failed to parse stored state for key "${key}"`
          );
        }
      }

      const originalSet = context.set;

      // Wrap set to persist changes
      context.set = (signal: any, updates: any) => {
        originalSet(signal, updates);

        // Get current state and save to localStorage
        const currentState: Record<string, any> = {};
        for (const key in context.store) {
          currentState[key] = context.store[key]();
        }

        try {
          localStorage.setItem(key, JSON.stringify(currentState));
        } catch (e) {
          console.warn(
            `[Lattice Persist] Failed to save state to localStorage`
          );
        }
      };

      return context;
    },
  };
}