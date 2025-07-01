/**
 * @fileoverview DevTools middleware - integrates with Redux DevTools Extension
 */

import type { ComponentContext, StoreConfig } from '../component/types';

/**
 * DevTools middleware - integrates with Redux DevTools Extension
 */
export function withDevtools<State extends Record<string, any>>(
  state: State,
  name = 'Lattice Store'
): StoreConfig<State> {
  return {
    state,
    enhancer: (context: ComponentContext<State>) => {
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
    },
  };
}