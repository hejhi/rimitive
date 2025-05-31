/**
 * @fileoverview Redux adapter for Lattice
 *
 * This adapter integrates Lattice components with Redux using Redux Toolkit.
 * It provides a seamless way to use Lattice's compositional patterns with
 * Redux's predictable state management.
 */

import { configureStore, createSlice as createReduxSlice } from '@reduxjs/toolkit';
import type {
  ComponentFactory,
  SliceFactory,
  SelectMarkerValue,
} from '@lattice/core';
import { SELECT_MARKER, SLICE_FACTORY_MARKER } from '@lattice/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Maps view types from slice factories to getter functions
 */
type ViewType<Model, T> = T extends () => SliceFactory<Model, infer S>
  ? () => S
  : T extends SliceFactory<Model, infer S>
  ? () => S
  : never;

/**
 * Maps all views in a component to their executed types
 */
type ExecutedViews<Model, Views> = {
  [K in keyof Views]: ViewType<Model, Views[K]>;
};

/**
 * Redux store enhanced with Lattice features
 */
export interface LatticeReduxStore<Model, Actions, Views> {
  // Standard Redux store methods
  dispatch: (action: any) => void;
  getState: () => Model;
  subscribe: (listener: () => void) => () => void;
  
  // Lattice enhancements
  actions: Actions;
  views: ExecutedViews<Model, Views>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Checks if an object is a select() marker
 */
function isSelectMarker<Model>(
  obj: unknown
): obj is Record<symbol, SelectMarkerValue<Model, unknown>> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof SELECT_MARKER !== 'undefined' &&
    SELECT_MARKER in obj
  );
}

/**
 * Checks if a function is a slice factory
 */
function isSliceFactory(fn: unknown): fn is SliceFactory<unknown, unknown> {
  return (
    typeof fn === 'function' &&
    SLICE_FACTORY_MARKER in fn &&
    fn[SLICE_FACTORY_MARKER] === true
  );
}

/**
 * Internal slice cache for select() resolution
 */
class SliceCache<Model> {
  private cache = new Map<SliceFactory<Model, unknown>, unknown>();

  get<T>(factory: SliceFactory<Model, T>): T | undefined {
    return this.cache.get(factory) as T | undefined;
  }

  set<T>(factory: SliceFactory<Model, T>, value: T): void {
    this.cache.set(factory, value);
  }
}

/**
 * Separates state data from functions in the model
 */
function separateStateAndActions<T extends Record<string, any>>(
  obj: T
): { state: any; actions: Record<string, Function> } {
  const state: any = {};
  const actions: Record<string, Function> = {};

  for (const key in obj) {
    if (typeof obj[key] === 'function') {
      actions[key] = obj[key];
    } else {
      state[key] = obj[key];
    }
  }

  return { state, actions };
}

/**
 * Checks if a selector is a composed selector
 */
function isComposedSelector(
  selector: unknown
): selector is { __composeDeps?: Record<string, SliceFactory<unknown, unknown>> } {
  return (
    typeof selector === 'function' &&
    '__composeDeps' in selector &&
    selector.__composeDeps != null
  );
}

/**
 * Recursively resolves select() markers and composed selectors in slice results
 */
function resolveSelectMarkers<T, Model>(
  obj: T,
  sliceCache: SliceCache<Model>,
  model: Model,
  executeSliceFactory?: <U>(factory: SliceFactory<Model, U>) => U
): T {
  // Primitives pass through unchanged
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  // Handle select() markers
  if (isSelectMarker<Model>(obj)) {
    const markerValue = obj[SELECT_MARKER];
    const sliceFactory = markerValue.slice;
    
    // Execute the slice factory to get fresh data
    let slice: any;
    if (executeSliceFactory) {
      slice = executeSliceFactory(sliceFactory);
    } else {
      // Fallback for when executeSliceFactory is not available
      const rawResult = sliceFactory(model);
      slice = resolveSelectMarkers(rawResult, sliceCache, model);
    }

    // Apply selector if present
    if (markerValue.selector) {
      return markerValue.selector(slice) as T;
    }

    return slice as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      resolveSelectMarkers(item, sliceCache, model, executeSliceFactory)
    ) as T;
  }

  // Handle objects
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = resolveSelectMarkers(obj[key], sliceCache, model, executeSliceFactory);
    }
  }
  return result;
}

// ============================================================================
// Main Adapter
// ============================================================================

/**
 * Creates a Redux store from a Lattice component
 */
export function createReduxAdapter<
  Model,
  Actions,
  Views extends Record<
    string,
    SliceFactory<Model, unknown> | (() => SliceFactory<Model, unknown>)
  >,
>(
  componentFactory: ComponentFactory<Model, Actions, Views>
): LatticeReduxStore<Model, Actions, Views> {
  // Execute component factory
  const spec = componentFactory();

  // Create initial model state
  const initialModel = spec.model({
    get: () => ({} as Model), // Temporary getter
    set: () => {}, // Temporary setter
  });

  // Separate state from actions
  const { state: initialState, actions: modelActions } = separateStateAndActions(initialModel);

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

  // Set up slice cache for select() resolution
  const sliceCache = new SliceCache<Model>();

  // Helper to execute a composed selector
  const executeComposedSelector = <T>(
    selector: any,
    model: Model
  ): T => {
    const deps = selector.__composeDeps || {};
    const resolvedDeps: any = {};
    
    for (const [key, depFactory] of Object.entries(deps)) {
      // Always re-execute dependencies to get fresh data
      resolvedDeps[key] = executeSliceFactory(depFactory as SliceFactory<Model, unknown>);
    }
    
    return selector(model, resolvedDeps);
  };

  // Create wrapper for slice execution that handles composed selectors
  const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
    // Don't cache results - they need to be recomputed on each access
    // because the underlying state may have changed
    
    const model = modelTools.get();
    let rawResult: any;
    
    // Check if this is a slice factory created with compose()
    // The compose() selector is stored in the factory's closure
    try {
      // Try to execute as a normal slice factory first
      rawResult = factory(model);
      
      // If the result is a function with __composeDeps, it's a composed selector
      // This happens when createSlice is called with compose() directly
      if (isComposedSelector(rawResult)) {
        rawResult = executeComposedSelector(rawResult, model);
      }
    } catch (error) {
      // If execution fails, it might be because the selector expects resolved deps
      // This is a fallback, but shouldn't normally happen
      throw error;
    }
    
    // Resolve any select markers in the result
    const resolved = resolveSelectMarkers(rawResult, sliceCache, model, executeSliceFactory);
    
    return resolved;
  };

  // Create actions using the wrapper
  const actionsFactory = spec.actions as SliceFactory<Model, Actions>;
  const actions = executeSliceFactory(actionsFactory);

  // Process views
  const views = {} as ExecutedViews<Model, Views>;
  for (const key in spec.views) {
    const view = spec.views[key];
    
    if (typeof view === 'function' && !isSliceFactory(view)) {
      // Computed view - returns a slice factory
      Object.defineProperty(views, key, {
        value: () => {
          const sliceFactory = view();
          return executeSliceFactory(sliceFactory);
        },
        enumerable: true,
        configurable: true,
      });
    } else {
      // Static view - is a slice factory
      Object.defineProperty(views, key, {
        value: () => {
          return executeSliceFactory(view as SliceFactory<Model, unknown>);
        },
        enumerable: true,
        configurable: true,
      });
    }
  }

  // Return enhanced Redux store
  return {
    dispatch: store.dispatch,
    getState: () => modelTools.get(),
    subscribe: store.subscribe,
    actions,
    views,
  };
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createComponent, createModel, createSlice, select } = await import(
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

    it('should support views with select() markers', () => {
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

        const buttonSlice = createSlice(model, (m) => ({
          onClick: select(actions, (a) => a.increment),
          disabled: m.disabled,
          label: `Count: ${m.count}`,
        }));

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

        const filteredTodosView = () =>
          todoState((state) => {
            const filtered =
              state.filter === 'all'
                ? state.todos
                : state.todos.filter((t) =>
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
      expect(todos.items.every((t) => !t.completed)).toBe(true);

      // Filter completed
      store.actions.setFilter('completed');
      todos = store.views.filteredTodos();
      expect(todos.count).toBe(1);
      expect(todos.items.every((t) => t.completed)).toBe(true);
    });
  });
}