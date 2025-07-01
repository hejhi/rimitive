/**
 * @fileoverview Logger middleware - logs all state changes
 */

import type { ComponentContext, Signal, StoreConfig } from '../component/types';

/**
 * Logger middleware - logs all state changes
 */
export function withLogger<State extends Record<string, any>>(
  state: State
): StoreConfig<State> {
  return {
    state,
    enhancer: (context: ComponentContext<State>) => {
      const originalSet = context.set;

      // Wrap set to log changes
      context.set = (<T>(
        signal: Signal<T>,
        updates: T | ((current: T) => T) | Partial<T>
      ) => {
        const currentValue = signal();
        let newValue: T;

        if (typeof updates === 'function') {
          newValue = (updates as (current: T) => T)(currentValue);
        } else if (
          typeof updates === 'object' &&
          updates !== null &&
          typeof currentValue === 'object' &&
          currentValue !== null &&
          !Array.isArray(currentValue) &&
          !(currentValue instanceof Set) &&
          !(currentValue instanceof Map)
        ) {
          // Partial update for objects
          newValue = { ...currentValue, ...updates };
        } else {
          newValue = updates as T;
        }

        // Log the update in a format that matches what was applied
        // For store properties, extract the property name from the signal
        const storeSignals = context.store;
        let updateLog: any = newValue;

        // Check if this is a store signal
        for (const [key, storeSignal] of Object.entries(storeSignals)) {
          if (storeSignal === signal) {
            updateLog = { [key]: newValue };
            break;
          }
        }

        console.log('[Lattice Logger] State update:', updateLog);

        originalSet(signal, newValue);
      }) as typeof context.set;

      return context;
    },
  };
}