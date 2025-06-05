/**
 * @fileoverview Redux adapter for Lattice
 *
 * This adapter integrates Lattice components with Redux using Redux Toolkit.
 * It provides a seamless way to use Lattice's compositional patterns with
 * Redux's predictable state management.
 */

import {
  configureStore as reduxConfigureStore,
  createSlice as createReduxSlice,
} from '@reduxjs/toolkit';
import type { Reducer, UnknownAction, Middleware } from 'redux';
import type {
  SliceFactory,
  AdapterResult,
  ViewTypes,
  ComponentFactory,
} from '@lattice/core';
import { isSliceFactory } from '@lattice/core';
import { createRuntime } from '@lattice/runtime';
import type { Store } from 'redux';

// ============================================================================
// Types
// ============================================================================

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
 *
 * @param componentFactory - The Lattice component factory
 * @param middleware - Optional function to apply Redux middleware
 * @returns An adapter result with Redux integration
 */
export function createReduxAdapter<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>,
  middleware?: (
    configureStore: typeof reduxConfigureStore,
    reducer: Reducer<StateProperties<Model>, UnknownAction>
  ) => Store<StateProperties<Model>>
): AdapterResult<Model, Actions, Views> {
  return createRuntime(() => {
    // Get the component spec
    const spec = componentFactory();

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

    // Create Redux store with optional middleware
    const store = middleware
      ? middleware(reduxConfigureStore, slice.reducer)
      : reduxConfigureStore({
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

    // Create wrapper for slice execution
    const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
      // Don't cache results - they need to be recomputed on each access
      // because the underlying state may have changed

      const model = modelTools.get();

      // Execute the slice factory with API
      return factory(model);
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
          return executeSliceFactory(view);
        };
      } else if (typeof view === 'function') {
        // Computed view - may accept parameters
        (views as Record<string, unknown>)[key] = (...args: unknown[]) => {
          // Call the view function with any provided args
          const result = view(...args);

          // If the result is a slice factory, execute it
          if (isSliceFactory(result)) {
            return executeSliceFactory(result);
          }

          // Otherwise return the result as-is
          return result;
        };
      }
    }

    // Create view-based subscribe that matches AdapterResult interface
    const subscribe = <Selected>(
      selector: (views: ViewTypes<Model, Views>) => Selected,
      callback: (value: Selected) => void
    ): (() => void) => {
      let previousSelected: Selected | undefined;

      return store.subscribe(() => {
        try {
          const currentSelected = selector(views);

          // Use Object.is for equality check (handles NaN, +0/-0 correctly)
          if (!Object.is(currentSelected, previousSelected)) {
            previousSelected = currentSelected;
            callback(currentSelected);
          }
        } catch (error) {
          // Silently ignore selector errors to prevent breaking other subscriptions
          // In production, the selector should handle its own errors
        }
      });
    };

    // Return enhanced Redux store
    return {
      getState: () => modelTools.get(),
      subscribe,
      actions,
      views,
      destroy: () => {
        // Clear the store state to release memory
        store.dispatch(slice.actions.updateState({}));

        // Note: Redux stores don't have a built-in destroy method.
        // Subscriptions will be garbage collected when their references are released.
        // If using Redux DevTools, the store will remain visible until the page is refreshed.
      },
    };
  });
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
          views: {
            count: createSlice(model, (m) => ({ value: m.count })),
          },
        };
      });

      const store = createReduxAdapter(counter);
      let callCount = 0;
      const values: number[] = [];

      const unsubscribe = store.subscribe(
        (views) => views.count().value,
        (value) => {
          callCount++;
          values.push(value);
        }
      );

      store.actions.increment();
      expect(callCount).toBe(1);
      expect(values[0]).toBe(1);

      store.actions.increment();
      expect(callCount).toBe(2);
      expect(values[1]).toBe(2);

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

        const filteredTodosView = createSlice(model, (m) => {
          const state = todoState(m);
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

    it('should handle views that use API through composition', () => {
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

        // Slice that uses API to compose data
        const statusSlice = createSlice(model, (m) => {
          // Can use API within slices
          const stateSlice = createSlice(model, (m) => ({
            count: m.count,
            message: m.message,
          }));
          const state = stateSlice(m);

          return {
            count: state.count,
            message: state.message,
            combined: `${state.message} (${state.count})`,
          };
        });

        return {
          model,
          actions,
          views: {
            status: statusSlice,
          },
        };
      });

      const store = createReduxAdapter(component);

      // Call the view
      const result = store.views.status();
      expect(result.count).toBe(0);
      expect(result.message).toBe('hello');
      expect(result.combined).toBe('hello (0)');

      // Update state via store actions
      store.actions.increment();
      store.actions.setMessage('updated');

      const updatedResult = store.views.status();
      expect(updatedResult.count).toBe(1);
      expect(updatedResult.message).toBe('updated');
      expect(updatedResult.combined).toBe('updated (1)');
    });

    it('should accept and apply Redux middleware', () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          lastAction: string;
          increment: () => void;
          decrement: () => void;
        }>(({ set, get }) => ({
          count: 0,
          lastAction: 'none',
          increment: () =>
            set({ count: get().count + 1, lastAction: 'increment' }),
          decrement: () =>
            set({ count: get().count - 1, lastAction: 'decrement' }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
        }));

        const views = {
          state: createSlice(model, (m) => ({
            count: m.count,
            lastAction: m.lastAction,
          })),
        };

        return { model, actions, views };
      });

      // Track middleware application
      let middlewareApplied = false;
      let loggedActions: string[] = [];

      // Custom middleware that adds logging
      const customMiddleware = (
        configureStore: typeof reduxConfigureStore,
        reducer: Reducer<
          StateProperties<{
            count: number;
            lastAction: string;
            increment: () => void;
            decrement: () => void;
          }>,
          UnknownAction
        >
      ) => {
        middlewareApplied = true;

        // Create a simple logging middleware with proper Redux types
        const loggingMiddleware: Middleware = () => (next) => (action) => {
          if (
            typeof action === 'object' &&
            action !== null &&
            'type' in action &&
            typeof action.type === 'string'
          ) {
            loggedActions.push(action.type);
          }
          return next(action);
        };

        return configureStore({
          reducer,
          middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({ serializableCheck: false }).concat(
              loggingMiddleware
            ),
        });
      };

      const store = createReduxAdapter(component, customMiddleware);

      // Verify middleware was applied
      expect(middlewareApplied).toBe(true);

      // Verify the store still works correctly
      expect(store.views.state().count).toBe(0);

      // Perform actions
      store.actions.increment();
      expect(store.views.state().count).toBe(1);
      expect(store.views.state().lastAction).toBe('increment');

      store.actions.decrement();
      expect(store.views.state().count).toBe(0);
      expect(store.views.state().lastAction).toBe('decrement');

      // Verify middleware logged the actions
      expect(loggedActions).toContain('lattice/updateState');
      expect(loggedActions.length).toBeGreaterThan(0);
    });
  });
}
