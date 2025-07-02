/**
 * @fileoverview Persist middleware - saves state to localStorage
 */

import type { ComponentContext, StoreConfig } from '../component/types';

/**
 * Persist middleware - saves state to localStorage
 */
export function withPersistence<State>(
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
          const parsed = JSON.parse(stored) as Partial<State>;
          // Update initial state - set each property individually
          for (const prop in parsed) {
            if (prop in context.store) {
              const value = parsed[prop];
              if (value !== undefined) {
                context.set(context.store[prop as keyof State], value);
              }
            }
          }
        } catch {
          console.warn(
            `[Lattice Persist] Failed to parse stored state for key "${key}"`
          );
        }
      }

      const originalSet = context.set;

      // Wrap set to persist changes
      context.set = ((...args: Parameters<typeof originalSet>) => {
        // Apply the original set function
        (originalSet as (...args: unknown[]) => void)(...args);

        // Get current state and save to localStorage
        const currentState: Record<string, unknown> = {};
        for (const key in context.store) {
          currentState[key] = context.store[key]();
        }

        try {
          localStorage.setItem(key, JSON.stringify(currentState));
        } catch {
          console.warn(
            `[Lattice Persist] Failed to save state to localStorage`
          );
        }
      }) as typeof originalSet;

      return context;
    },
  };
}