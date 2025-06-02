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

export interface ReduxAdapterResult<Model, Actions, Views> extends AdapterResult<Model, Actions, Views> {
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
  componentOrFactory: ComponentSpec<Model, Actions, Views> | (() => ComponentSpec<Model, Actions, Views>)
): ReduxAdapterResult<Model, Actions, Views> {
  // Get the component spec
  const spec = typeof componentOrFactory === 'function' 
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

  // Create wrapper for slice execution
  const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
    // Don't cache results - they need to be recomputed on each access
    // because the underlying state may have changed

    const model = modelTools.get();
    let rawResult: T | SliceFactory<Model, T>;

    // Execute the slice factory
    rawResult = factory(model);

    // If the result is itself a slice factory (from transform syntax), execute it
    if (isSliceFactory(rawResult)) {
      rawResult = executeSliceFactory(rawResult as SliceFactory<Model, T>);
    }

    // Return the result directly
    return rawResult as T;
  };

  // Create actions using the wrapper
  const actionsFactory = spec.actions as SliceFactory<Model, Actions>;
  const actions = executeSliceFactory(actionsFactory);

  // Process views
  const views = {} as ViewTypes<Model, Views>;
  for (const [key, view] of Object.entries(spec.views as Record<string, unknown>)) {
    if (isSliceFactory(view)) {
      // Static view: slice factory
      (views as Record<string, unknown>)[key] = () => {
        const value = executeSliceFactory(view);
        // Return a shallow copy to ensure fresh references
        return typeof value === 'object' && value !== null 
          ? Array.isArray(value) ? [...value] : { ...value }
          : value;
      };
    } else if (typeof view === 'function') {
      // Function view - use as-is without double execution
      // The function should return the final view data, not a SliceFactory
      (views as Record<string, unknown>)[key] = view;
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
    }
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

        const filteredTodosView = todoState((state) => {
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
      expect(todos.items.every((t: { completed: boolean }) => !t.completed)).toBe(true);

      // Filter completed
      store.actions.setFilter('completed');
      todos = store.views.filteredTodos();
      expect(todos.count).toBe(1);
      expect(todos.items.every((t: { completed: boolean }) => t.completed)).toBe(true);
    });
  });
}
