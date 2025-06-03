/**
 * @fileoverview Redux adapter for Lattice
 *
 * This adapter integrates Lattice components with Redux using Redux Toolkit.
 * It provides a seamless way to use Lattice's compositional patterns with
 * Redux's predictable state management.
 */

import {
  configureStore,
  createSlice as createReduxSlice,
} from '@reduxjs/toolkit';
import type {
  ComponentSpec,
  SliceFactory,
  AdapterResult,
  ViewTypes,
  AdapterAPI,
} from '@lattice/core';
import { isSliceFactory } from '@lattice/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Redux adapter result that implements the standard AdapterResult interface
 */
// Redux action type for state updates
interface UpdateStateAction<Model> {
  type: 'lattice/updateState';
  payload: Partial<Model>;
}

export interface ReduxAdapterResult<Model, Actions, Views>
  extends AdapterResult<Model, Actions, Views> {
  // Standard Redux store methods
  dispatch: (action: UpdateStateAction<Model>) => void;
  getState: () => Model;
  subscribe: (listener: () => void) => () => void;

  // Cleanup method
  destroy: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

// Type for extracting non-function properties
type StateProperties<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

// Type for extracting function properties
type ActionProperties<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K];
};

/**
 * Separates state data from functions in the model
 */
function separateStateAndActions<T>(obj: T): {
  state: StateProperties<T>;
  actions: ActionProperties<T>;
} {
  const state = {} as StateProperties<T>;
  const actions = {} as ActionProperties<T>;

  for (const key in obj) {
    if (typeof obj[key] === 'function') {
      (actions as Record<string, unknown>)[key] = obj[key];
    } else {
      (state as Record<string, unknown>)[key] = obj[key];
    }
  }

  return { state, actions };
}

// ============================================================================
// Main Adapter
// ============================================================================

/**
 * Creates a Redux store from a Lattice component
 */
export function createReduxAdapter<Model, Actions, Views>(
  componentOrFactory:
    | ComponentSpec<Model, Actions, Views>
    | (() => ComponentSpec<Model, Actions, Views>)
): ReduxAdapterResult<Model, Actions, Views> {
  // Get the component spec
  const spec =
    typeof componentOrFactory === 'function'
      ? componentOrFactory()
      : componentOrFactory;

  // Create initial model state
  const initialModel = spec.model({
    get: () => ({}) as Model, // Temporary getter
    set: () => {}, // Temporary setter
  });

  // Separate state from actions
  const { state: initialState, actions: modelActions } =
    separateStateAndActions(initialModel);

  // Create Redux slice for state only
  const slice = createReduxSlice({
    name: 'lattice',
    initialState,
    reducers: {
      updateState: (state, action) => {
        // Apply partial updates
        Object.assign(state, action.payload);
      },
    },
  });

  // Create Redux store with middleware disabled for non-serializable checks
  const store = configureStore({
    reducer: slice.reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });

  // Create model tools that work with Redux
  const modelTools = {
    get: () => {
      // Return combined state and actions
      return { ...store.getState(), ...modelActions } as Model;
    },
    set: (updates: Partial<Model>) => {
      // Filter out functions from updates
      const { state: stateUpdates } = separateStateAndActions(updates);
      if (Object.keys(stateUpdates).length > 0) {
        store.dispatch(slice.actions.updateState(stateUpdates));
      }
    },
  };

  // Re-execute the model factory with proper tools to bind actions correctly
  const boundModel = spec.model(modelTools);

  // Extract the bound actions
  const { actions: boundActions } = separateStateAndActions(boundModel);

  // Update modelActions reference
  Object.assign(modelActions, boundActions);

  // Create the AdapterAPI implementation with Redux-specific extensions
  const adapterApi: AdapterAPI<Model> & {
    dispatch: typeof store.dispatch;
    getReduxState: typeof store.getState;
  } = {
    executeSlice: <T>(slice: SliceFactory<Model, T>): T => {
      const model = modelTools.get();
      return slice(model, adapterApi);
    },
    getState: () => modelTools.get(),
    // Redux-specific methods
    dispatch: store.dispatch,
    getReduxState: store.getState, // Direct access to Redux store state (without model actions)
  };

  // Create wrapper for slice execution
  const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
    // Don't cache results - they need to be recomputed on each access
    // because the underlying state may have changed

    const model = modelTools.get();

    // Execute the slice factory with API
    return factory(model, adapterApi);
  };

  // Create actions using the wrapper
  const actions = executeSliceFactory(spec.actions);

  // Process views
  const views = {} as ViewTypes<Model, Views>;
  for (const [key, view] of Object.entries(
    spec.views as Record<string, unknown>
  )) {
    if (isSliceFactory(view)) {
      // Static view: slice factory
      (views as Record<string, unknown>)[key] = () => {
        const value = executeSliceFactory(view);
        // Return a shallow copy to ensure fresh references
        return typeof value === 'object' && value !== null
          ? Array.isArray(value)
            ? [...value]
            : { ...value }
          : value;
      };
    } else if (typeof view === 'function') {
      // Computed view - wrap to inject API as last parameter
      (views as Record<string, unknown>)[key] = (...args: unknown[]) => {
        // Call the view function with user args + api as last argument
        const result = view(...args, adapterApi);

        // If the result is a slice factory, execute it with the API
        if (isSliceFactory(result)) {
          return executeSliceFactory(result);
        }

        // Otherwise return the result as-is
        return result;
      };
    }
  }

  // Return enhanced Redux store
  return {
    dispatch: store.dispatch,
    getState: () => modelTools.get(),
    subscribe: store.subscribe,
    actions,
    views,
    destroy: () => {
      // Redux store doesn't need explicit cleanup, but we can add it for consistency
    },
  };
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createComponent, createModel, createSlice, compose } = await import(
    '@lattice/core'
  );

  describe('createReduxAdapter', () => {
    it('should create a Redux store from a Lattice component', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
        }));

        return {
          model,
          actions,
          views: {},
        };
      });

      const store = createReduxAdapter(counter);

      // Verify initial state
      expect(store.getState().count).toBe(0);

      // Test actions
      store.actions.increment();
      expect(store.getState().count).toBe(1);

      store.actions.decrement();
      expect(store.getState().count).toBe(0);
    });

    it('should support views with state derivation', () => {
      const component = createComponent(() => {
        const model = createModel<{
          firstName: string;
          lastName: string;
          setFirstName: (name: string) => void;
          setLastName: (name: string) => void;
        }>(({ set }) => ({
          firstName: 'John',
          lastName: 'Doe',
          setFirstName: (name) => set({ firstName: name }),
          setLastName: (name) => set({ lastName: name }),
        }));

        const displaySlice = createSlice(model, (m) => ({
          fullName: `${m.firstName} ${m.lastName}`,
          initials: `${m.firstName[0]}${m.lastName[0]}`,
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setFirstName: m.setFirstName,
            setLastName: m.setLastName,
          })),
          views: {
            display: displaySlice,
          },
        };
      });

      const store = createReduxAdapter(component);

      // Test initial view
      const display = store.views.display();
      expect(display.fullName).toBe('John Doe');
      expect(display.initials).toBe('JD');

      // Update state and test view reactivity
      store.actions.setFirstName('Jane');
      const updatedDisplay = store.views.display();
      expect(updatedDisplay.fullName).toBe('Jane Doe');
      expect(updatedDisplay.initials).toBe('JD');
    });

    it('should handle subscriptions', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({ increment: m.increment })),
          views: {},
        };
      });

      const store = createReduxAdapter(counter);
      let callCount = 0;

      const unsubscribe = store.subscribe(() => {
        callCount++;
      });

      store.actions.increment();
      expect(callCount).toBe(1);

      store.actions.increment();
      expect(callCount).toBe(2);

      unsubscribe();
      store.actions.increment();
      expect(callCount).toBe(2); // No more updates
    });

    it('should support views with compose()', () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          disabled: boolean;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          disabled: false,
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const buttonSlice = createSlice(
          model,
          compose({ actions }, (m, { actions }) => ({
            onClick: actions.increment,
            disabled: m.disabled,
            label: `Count: ${m.count}`,
          }))
        );

        return {
          model,
          actions,
          views: {
            button: buttonSlice,
          },
        };
      });

      const store = createReduxAdapter(component);
      const button = store.views.button();

      expect(typeof button.onClick).toBe('function');
      expect(button.disabled).toBe(false);
      expect(button.label).toBe('Count: 0');

      // Test that onClick works
      button.onClick();
      const updatedButton = store.views.button();
      expect(updatedButton.label).toBe('Count: 1');
    });

    it('should support computed views', () => {
      const component = createComponent(() => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; completed: boolean }>;
          filter: 'all' | 'active' | 'completed';
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set }) => ({
          todos: [
            { id: 1, text: 'Task 1', completed: false },
            { id: 2, text: 'Task 2', completed: true },
            { id: 3, text: 'Task 3', completed: false },
          ],
          filter: 'all',
          setFilter: (filter) => set({ filter }),
        }));

        const todoState = createSlice(model, (m) => ({
          todos: m.todos,
          filter: m.filter,
        }));

        const filteredTodosView = createSlice(model, (_m, api) => {
          const state = api.executeSlice(todoState);
          const filtered =
            state.filter === 'all'
              ? state.todos
              : state.todos.filter((t: { completed: boolean }) =>
                  state.filter === 'active' ? !t.completed : t.completed
                );

          return {
            items: filtered,
            count: filtered.length,
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({
            setFilter: m.setFilter,
          })),
          views: {
            filteredTodos: filteredTodosView,
          },
        };
      });

      const store = createReduxAdapter(component);

      // Test initial state
      let todos = store.views.filteredTodos();
      expect(todos.count).toBe(3);

      // Filter active
      store.actions.setFilter('active');
      todos = store.views.filteredTodos();
      expect(todos.count).toBe(2);
      expect(
        todos.items.every((t: { completed: boolean }) => !t.completed)
      ).toBe(true);

      // Filter completed
      store.actions.setFilter('completed');
      todos = store.views.filteredTodos();
      expect(todos.count).toBe(1);
      expect(
        todos.items.every((t: { completed: boolean }) => t.completed)
      ).toBe(true);
    });

    it('should provide Redux-specific dispatch and getReduxState methods in API', () => {
      let capturedApi: any;

      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m, api) => {
          capturedApi = api;
          return {
            increment: m.increment,
          };
        });

        return {
          model,
          actions,
          views: {},
        };
      });

      createReduxAdapter(component);

      // Verify API was captured and has Redux-specific methods
      expect(capturedApi).toBeDefined();
      expect(typeof capturedApi.dispatch).toBe('function');
      expect(typeof capturedApi.getReduxState).toBe('function');
      expect(typeof capturedApi.executeSlice).toBe('function');
      expect(typeof capturedApi.getState).toBe('function');

      // Test that dispatch works
      const initialState = capturedApi.getReduxState();
      expect(initialState.count).toBe(0);

      // Dispatch an action to update state
      capturedApi.dispatch({
        type: 'lattice/updateState',
        payload: { count: 5 },
      });

      const updatedState = capturedApi.getReduxState();
      expect(updatedState.count).toBe(5);

      // Verify getState returns the full model (state + actions)
      const fullModel = capturedApi.getState();
      expect(fullModel.count).toBe(5);
      expect(typeof fullModel.increment).toBe('function');
    });

    it('should inject API as last parameter to computed views', () => {
      const component = createComponent(() => {
        const model = createModel<{
          items: string[];
          filter: string;
          setFilter: (filter: string) => void;
        }>(({ set }) => ({
          items: ['apple', 'banana', 'cherry', 'apricot'],
          filter: 'a',
          setFilter: (filter) => set({ filter }),
        }));

        // Base slice to access items
        const itemsSlice = createSlice(model, (m) => m.items);

        // Computed view that takes arguments and receives API as last parameter
        const filteredView = function (this: any, ...args: any[]) {
          // Check if last argument is the API
          const lastArg = args[args.length - 1];
          const api =
            lastArg &&
            typeof lastArg.executeSlice === 'function' &&
            typeof lastArg.getState === 'function'
              ? lastArg
              : undefined;

          // Get the prefix if provided (excluding API)
          const prefix =
            api && args.length > 1
              ? args[0]
              : !api && args.length > 0
                ? args[0]
                : undefined;

          // If API is provided, use it to execute other slices
          if (api) {
            const items = api.executeSlice(itemsSlice);
            const filter = api.getState().filter;
            const filtered = items.filter((item: string) =>
              item.includes(filter)
            );
            return {
              items: prefix
                ? filtered.map((item: string) => prefix + item)
                : filtered,
              count: filtered.length,
              hasApi: true,
            };
          }

          // Fallback if no API
          return {
            items: [],
            count: 0,
            hasApi: false,
          };
        };

        return {
          model,
          actions: createSlice(model, (m) => ({
            setFilter: m.setFilter,
          })),
          views: {
            filtered: filteredView as (prefix?: string) => any,
          },
        };
      });

      const store = createReduxAdapter(component);

      // Test without arguments - API should still be injected
      let result = (store.views as any).filtered();
      expect(result.hasApi).toBe(true);
      expect(result.items).toEqual(['apple', 'banana', 'apricot']);
      expect(result.count).toBe(3);

      // Test with arguments - API should be injected as last parameter
      result = (store.views as any).filtered('fruit: ');
      expect(result.hasApi).toBe(true);
      expect(result.items).toEqual([
        'fruit: apple',
        'fruit: banana',
        'fruit: apricot',
      ]);
      expect(result.count).toBe(3);

      // Change filter and verify it works
      store.actions.setFilter('ban');
      result = (store.views as any).filtered();
      expect(result.items).toEqual(['banana']);
      expect(result.count).toBe(1);
    });

    it('should provide dispatch and getReduxState methods in API for computed views', () => {
      let capturedApi: any;

      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          message: string;
          increment: () => void;
          setMessage: (msg: string) => void;
        }>(({ set, get }) => ({
          count: 0,
          message: 'hello',
          increment: () => set({ count: get().count + 1 }),
          setMessage: (msg) => set({ message: msg }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          setMessage: m.setMessage,
        }));

        // Computed view that captures the API and uses Redux-specific methods
        const computedView = function (this: any, ...args: any[]) {
          const api = args[args.length - 1];
          capturedApi = api;

          if (
            api &&
            typeof api.dispatch === 'function' &&
            typeof api.getReduxState === 'function'
          ) {
            // Get the Redux state (without actions)
            const reduxState = api.getReduxState();

            return {
              hasReduxMethods: true,
              count: reduxState.count,
              message: reduxState.message,
              // Verify getState includes actions while getReduxState doesn't
              hasActions: typeof api.getState().increment === 'function',
              reduxHasActions: typeof reduxState.increment === 'function',
            };
          }

          return { hasReduxMethods: false };
        };

        return {
          model,
          actions,
          views: {
            status: computedView as () => any,
          },
        };
      });

      const store = createReduxAdapter(component);

      // Call the computed view
      const result = (store.views as any).status();

      // Verify the API was passed and has Redux-specific methods
      expect(capturedApi).toBeDefined();
      expect(typeof capturedApi.dispatch).toBe('function');
      expect(typeof capturedApi.getReduxState).toBe('function');
      expect(result.hasReduxMethods).toBe(true);
      expect(result.count).toBe(0);
      expect(result.message).toBe('hello');
      expect(result.hasActions).toBe(true); // getState includes actions
      expect(result.reduxHasActions).toBe(false); // getReduxState excludes actions

      // Test that dispatch works from within the view
      capturedApi.dispatch({
        type: 'lattice/updateState',
        payload: { count: 10, message: 'updated' },
      });

      const updatedResult = (store.views as any).status();
      expect(updatedResult.count).toBe(10);
      expect(updatedResult.message).toBe('updated');
    });
  });
}
