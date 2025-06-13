/**
 * @fileoverview Example store enhancers for Svelte adapter
 *
 * These are example enhancers that show how to extend Svelte stores
 * with additional functionality like logging, time-travel debugging,
 * and devtools integration.
 */

import type { StoreEnhancer } from './index';

/**
 * Logging enhancer that logs all state updates
 *
 * @example
 * ```typescript
 * const store = createSvelteAdapter(createComponent, withLogging());
 * ```
 */
export function withLogging<State>(options?: {
  collapsed?: boolean;
  logger?: Pick<Console, 'log' | 'group' | 'groupCollapsed' | 'groupEnd'>;
}): StoreEnhancer<State> {
  const logger = options?.logger ?? console;
  const groupMethod = options?.collapsed ? 'groupCollapsed' : 'group';

  return (store) => {
    const { subscribe, set, update } = store;
    let updateCount = 0;

    return {
      subscribe,
      set: (value) => {
        const timestamp = new Date().toISOString();
        logger[groupMethod](
          `[Lattice] State Update #${++updateCount} @ ${timestamp}`
        );
        logger.log('New State:', value);
        logger.groupEnd();
        set(value);
      },
      update: (updater) => {
        const timestamp = new Date().toISOString();
        logger[groupMethod](
          `[Lattice] State Update #${++updateCount} @ ${timestamp}`
        );
        update((state) => {
          const newState = updater(state);
          logger.log('Previous State:', state);
          logger.log('New State:', newState);
          logger.groupEnd();
          return newState;
        });
      },
    };
  };
}

/**
 * Time-travel debugging enhancer
 *
 * @example
 * ```typescript
 * const store = createSvelteAdapter(createComponent, withTimeTravel());
 *
 * // Access time-travel methods
 * (store as any).__timeTravel.undo();
 * (store as any).__timeTravel.redo();
 * (store as any).__timeTravel.jumpTo(5);
 * ```
 */
export function withTimeTravel<State>(options?: {
  maxHistory?: number;
}): StoreEnhancer<State> {
  const maxHistory = options?.maxHistory ?? 50;

  return (store) => {
    const { subscribe, set, update } = store;
    const history: State[] = [];
    let currentIndex = -1;
    let isTimeTraveling = false;

    // Helper to add state to history
    const addToHistory = (state: State) => {
      if (!isTimeTraveling) {
        // Remove any states after current index (when we've undone and then make a new change)
        history.splice(currentIndex + 1);
        history.push(JSON.parse(JSON.stringify(state))); // Deep clone

        // Limit history size
        if (history.length > maxHistory) {
          history.shift();
        } else {
          currentIndex++;
        }
      }
    };

    // Time travel methods
    const timeTravelAPI = {
      undo: () => {
        if (currentIndex > 0) {
          isTimeTraveling = true;
          currentIndex--;
          set(JSON.parse(JSON.stringify(history[currentIndex])));
          isTimeTraveling = false;
        }
      },
      redo: () => {
        if (currentIndex < history.length - 1) {
          isTimeTraveling = true;
          currentIndex++;
          set(JSON.parse(JSON.stringify(history[currentIndex])));
          isTimeTraveling = false;
        }
      },
      jumpTo: (index: number) => {
        if (index >= 0 && index < history.length) {
          isTimeTraveling = true;
          currentIndex = index;
          set(JSON.parse(JSON.stringify(history[currentIndex])));
          isTimeTraveling = false;
        }
      },
      getHistory: () => history.slice(),
      getCurrentIndex: () => currentIndex,
      canUndo: () => currentIndex > 0,
      canRedo: () => currentIndex < history.length - 1,
    };

    // Enhanced store with time travel
    const enhancedStore = {
      subscribe: (
        run: (value: State) => void,
        invalidate?: (value?: State) => void
      ) => {
        // Capture initial state
        const unsubscribe = subscribe((state) => {
          if (history.length === 0) {
            addToHistory(state);
          }
          run(state);
        }, invalidate);

        return unsubscribe;
      },
      set: (value: State) => {
        addToHistory(value);
        set(value);
      },
      update: (updater: (state: State) => State) => {
        update((state) => {
          const newState = updater(state);
          addToHistory(newState);
          return newState;
        });
      },
    };

    // Attach time travel API (in production, you might expose this differently)
    (enhancedStore as any).__timeTravel = timeTravelAPI;

    return enhancedStore;
  };
}

/**
 * Redux DevTools enhancer for Svelte stores
 *
 * @example
 * ```typescript
 * const store = createSvelteAdapter(
 *   createComponent,
 *   withDevtools({ name: 'My App' })
 * );
 * ```
 */
export function withDevtools<State>(options?: {
  name?: string;
  features?: {
    pause?: boolean;
    lock?: boolean;
    persist?: boolean;
    export?: boolean;
    import?: boolean;
    jump?: boolean;
    skip?: boolean;
    reorder?: boolean;
    dispatch?: boolean;
    test?: boolean;
  };
}): StoreEnhancer<State> {
  // Check if Redux DevTools Extension is available
  const devtools =
    typeof window !== 'undefined' &&
    (window as any).__REDUX_DEVTOOLS_EXTENSION__;

  if (!devtools) {
    // Return unchanged store if devtools not available
    return (store) => store;
  }

  return (store) => {
    const { subscribe, set, update } = store;
    let devtoolsInstance: any;
    let actionId = 0;

    return {
      subscribe: (
        run: (value: State) => void,
        invalidate?: (value?: State) => void
      ) => {
        // Initialize devtools on first subscription
        if (!devtoolsInstance) {
          devtoolsInstance = devtools.connect({
            name: options?.name ?? 'Lattice Store',
            features: options?.features,
          });

          // Subscribe to devtools actions (time travel, etc.)
          devtoolsInstance.subscribe((message: any) => {
            if (message.type === 'DISPATCH') {
              switch (message.payload.type) {
                case 'JUMP_TO_ACTION':
                case 'JUMP_TO_STATE':
                  set(JSON.parse(message.state));
                  break;
                case 'RESET':
                  devtoolsInstance.init(store);
                  break;
              }
            }
          });
        }

        const unsubscribe = subscribe((state) => {
          run(state);
          // Send state to devtools
          if (devtoolsInstance) {
            devtoolsInstance.send({ type: '@@UPDATE', id: actionId++ }, state);
          }
        }, invalidate);

        return () => {
          unsubscribe();
          // Disconnect devtools if no more subscribers
          if (devtoolsInstance) {
            devtoolsInstance.disconnect();
            devtoolsInstance = null;
          }
        };
      },
      set: (value: State) => {
        set(value);
        if (devtoolsInstance) {
          devtoolsInstance.send(
            { type: '@@SET', payload: value, id: actionId++ },
            value
          );
        }
      },
      update: (updater: (state: State) => State) => {
        update((state) => {
          const newState = updater(state);
          if (devtoolsInstance) {
            devtoolsInstance.send(
              {
                type: '@@UPDATE',
                payload: { prev: state, next: newState },
                id: actionId++,
              },
              newState
            );
          }
          return newState;
        });
      },
    };
  };
}

/**
 * Compose multiple enhancers together
 *
 * @example
 * ```typescript
 * const store = createSvelteAdapter(
 *   createComponent,
 *   composeEnhancers(
 *     withLogging({ collapsed: true }),
 *     withTimeTravel({ maxHistory: 100 }),
 *     withDevtools({ name: 'My App' })
 *   )
 * );
 * ```
 */
export function composeEnhancers<State>(
  ...enhancers: StoreEnhancer<State>[]
): StoreEnhancer<State> {
  return (store) =>
    enhancers.reduceRight((enhanced, enhancer) => enhancer(enhanced), store);
}
