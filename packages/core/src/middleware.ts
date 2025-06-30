/**
 * @fileoverview Built-in middleware for Lattice components
 */

import type { ComponentMiddleware, Signal } from './runtime-types';

/**
 * Logger middleware - logs all state changes
 */
export function withLogger<State>(): ComponentMiddleware<State> {
  return (context) => {
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
  };
}

/**
 * DevTools middleware - integrates with Redux DevTools Extension
 */
export function withDevtools<State>(name = 'Lattice Store'): ComponentMiddleware<State> {
  return (context) => {
      // Check if devtools extension is available
      const devtoolsExt = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
      if (!devtoolsExt) return context;

      const devtools = devtoolsExt.connect({ name });
      const originalSet = context.set;

      // Send initial state
      const initialState: any = {};
      for (const key in context.store) {
        initialState[key] = context.store[key]();
      }
      devtools.init(initialState);

      // Wrap set to send actions to devtools
      context.set = ((signal: any, updates: any) => {
        // Call original set
        originalSet(signal, updates);

        // Find which property was updated
        let updatedKey: string | undefined;
        let updateValue: any;

        for (const key in context.store) {
          if (context.store[key] === signal) {
            updatedKey = key;
            updateValue = signal();
            break;
          }
        }

        // Get current state after update
        const currentState: any = {};
        for (const key in context.store) {
          currentState[key] = context.store[key]();
        }

        // Send action to devtools
        const payload = updatedKey ? { [updatedKey]: updateValue } : {};
        devtools.send({ type: 'SET_STATE', payload }, currentState);
      }) as any;

      return context;
  };
}

/**
 * Persist middleware - saves state to localStorage
 */
export function withPersistence<State>(key: string): ComponentMiddleware<State> {
  return (context) => {
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
      context.set = ((signal: any, updates: any) => {
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
      }) as any;

      return context;
  };
}
