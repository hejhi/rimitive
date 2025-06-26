/**
 * @fileoverview Built-in middleware for Lattice components
 */

import type { ComponentMiddleware } from './runtime-types';

/**
 * Logger middleware - logs all state changes
 */
export function logger<State>(): ComponentMiddleware<State> {
  return (context) => {
    const originalSet = context.set;
    
    // Wrap set to log changes
    context.set = (updates) => {
      const updateObj = typeof updates === 'function' 
        ? updates(context.store) 
        : updates;
      
      console.log('[Lattice Logger] State update:', updateObj);
      originalSet(updates);
    };
    
    return context;
  };
}

/**
 * DevTools middleware - integrates with Redux DevTools Extension
 */
export function devtools<State>(name = 'Lattice Store'): ComponentMiddleware<State> {
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
    context.set = (updates) => {
      const updateObj = typeof updates === 'function' 
        ? updates(context.store) 
        : updates;
      
      originalSet(updates);
      
      // Get current state
      const currentState: any = {};
      for (const key in context.store) {
        currentState[key] = context.store[key]();
      }
      
      // Send action to devtools
      devtools.send(
        { type: 'SET_STATE', payload: updateObj },
        currentState
      );
    };
    
    return context;
  };
}

/**
 * Persist middleware - saves state to localStorage
 */
export function persist<State>(key: string): ComponentMiddleware<State> {
  return (context) => {
    // Try to load initial state from localStorage
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Update initial state
        context.set(parsed);
      } catch (e) {
        console.warn(`[Lattice Persist] Failed to parse stored state for key "${key}"`);
      }
    }
    
    const originalSet = context.set;
    
    // Wrap set to persist changes
    context.set = (updates) => {
      originalSet(updates);
      
      // Get current state and save to localStorage
      const currentState: Record<string, any> = {};
      for (const key in context.store) {
        currentState[key] = context.store[key]();
      }
      
      try {
        localStorage.setItem(key, JSON.stringify(currentState));
      } catch (e) {
        console.warn(`[Lattice Persist] Failed to save state to localStorage`);
      }
    };
    
    return context;
  };
}