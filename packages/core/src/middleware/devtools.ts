/**
 * @fileoverview DevTools middleware - integrates with Redux DevTools Extension
 */

import type { ComponentContext, SetState } from '../component/types';

interface ReduxDevToolsExtension {
  connect(options: { name: string }): {
    init(state: unknown): void;
    send(action: { type: string; payload: unknown }, state: unknown): void;
  };
}

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevToolsExtension;
  }
}

/**
 * DevTools middleware - integrates with Redux DevTools Extension
 */
export function withDevtools<State extends Record<string, unknown>>(
  context: ComponentContext<State>,
  name = 'Lattice Store'
): ComponentContext<State> {
  // Check if devtools extension is available
  const devtoolsExt = window.__REDUX_DEVTOOLS_EXTENSION__;
  if (!devtoolsExt) return context;

  const devtools = devtoolsExt.connect({ name });
  const originalSet = context.set;

  // Send initial state
  const initialState: Record<string, unknown> = {};
  for (const key in context.store) {
    initialState[key] = context.store[key]();
  }
  devtools.init(initialState);

  // Wrap set to send actions to devtools
  const enhancedSet: SetState = ((
    signal: Parameters<SetState>[0],
    updates?: Parameters<SetState>[1]
  ) => {
    // Call original set
    originalSet(signal, updates);

    // Find which property was updated
    let updatedKey: string | undefined;
    let updateValue: unknown;

    if (signal === context.store) {
      // Batch update
      updatedKey = 'BATCH_UPDATE';
      updateValue = updates;
    } else {
      // Single signal update
      for (const key in context.store) {
        if (context.store[key] === signal) {
          updatedKey = key;
          updateValue = context.store[key]();
          break;
        }
      }
    }

    // Get current state after update
    const currentState: Record<string, unknown> = {};
    for (const key in context.store) {
      currentState[key] = context.store[key]();
    }

    // Send action to devtools
    const payload = updatedKey ? { [updatedKey]: updateValue } : {};
    devtools.send({ type: 'SET_STATE', payload }, currentState);
  }) as SetState;

  context.set = enhancedSet;

  return context;
}
