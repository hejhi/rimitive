/**
 * @fileoverview Memory adapter with clean runtime architecture
 */

import type {
  ComponentSpec,
  AdapterResult,
  AdapterAPI,
  SliceFactory,
  ViewTypes,
} from '@lattice/core';
import { isSliceFactory } from '@lattice/core';
import { createRuntime } from '@lattice/runtime';

// ============================================================================
// Store Implementation (unchanged)
// ============================================================================

interface Store<T> {
  get: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  subscribe: (listener: (value: T) => void) => () => void;
  destroy?: () => void;
}

function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(value: T) => void>();

  return {
    get: () => state,
    set: (value: T | ((prev: T) => T)) => {
      const newValue =
        typeof value === 'function' ? (value as (prev: T) => T)(state) : value;
      if (newValue !== state) {
        state = newValue;
        listeners.forEach((listener) => listener(state));
      }
    },
    subscribe: (listener: (value: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      listeners.clear();
    },
  };
}

function createSlice<T, U>(
  store: Store<T>,
  selector: (state: T) => U
): Store<U> {
  const listeners = new Set<(value: U) => void>();
  let cache: { value: U; state: T } | undefined;

  const unsubscribe = store.subscribe((state) => {
    const newValue = selector(state);
    if (!cache || cache.value !== newValue) {
      cache = { value: newValue, state };
      listeners.forEach((listener) => listener(newValue));
    }
  });

  return {
    get: () => {
      const state = store.get();
      if (!cache || cache.state !== state) {
        const value = selector(state);
        cache = { value, state };
      }
      return cache.value;
    },
    set: () => {
      throw new Error(
        'Cannot set value on a slice - slices are read-only projections'
      );
    },
    subscribe: (listener: (value: U) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      unsubscribe();
      listeners.clear();
    },
  };
}

function shallowCopy<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return [...value] as T;
  }
  return { ...value };
}

// ============================================================================
// Memory Adapter Result
// ============================================================================

export interface MemoryAdapterResult<Model, Actions, Views>
  extends AdapterResult<Model, Actions, Views> {
  getState: () => Model;
  destroy: () => void;
}

// ============================================================================
// Component Execution
// ============================================================================

function executeComponent<Model, Actions, Views>(
  spec: ComponentSpec<Model, Actions, Views>,
  api: AdapterAPI<Model>,
  modelStore: Store<Model>
): MemoryAdapterResult<Model, Actions, Views> {
  // Type-safe slice executor
  const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
    return api.executeSlice(factory);
  };

  // Execute actions slice
  const actionsStore = createSlice(modelStore, () =>
    executeSliceFactory(spec.actions)
  );

  // Process views
  const viewStores: Array<Store<unknown>> = [];

  const views = Object.entries(spec.views as Record<string, unknown>).reduce(
    (acc, [key, view]) => {
      if (isSliceFactory(view)) {
        const viewStore = createSlice<Model, unknown>(modelStore, () =>
          executeSliceFactory(view)
        );
        viewStores.push(viewStore);

        acc[key as keyof ViewTypes<Model, Views>] = (() =>
          shallowCopy(viewStore.get())) as ViewTypes<
          Model,
          Views
        >[keyof ViewTypes<Model, Views>];
      } else if (typeof view === 'function') {
        acc[key as keyof ViewTypes<Model, Views>] = ((...args: unknown[]) => {
          const result = view(...args, api);
          
          if (isSliceFactory(result)) {
            return api.executeSlice(result);
          }
          
          return result;
        }) as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
      }

      return acc;
    },
    {} as ViewTypes<Model, Views>
  );

  return {
    actions: actionsStore.get(),
    views,
    getState: api.getState,
    destroy: () => {
      modelStore.destroy?.();
      actionsStore.destroy?.();
      viewStores.forEach((store) => store.destroy?.());
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Creates a memory adapter for Lattice components.
 * 
 * The memory adapter is a simple in-memory store implementation
 * without native middleware support.
 */
export function createMemoryAdapter<Model, Actions, Views>(
  componentOrFactory:
    | ComponentSpec<Model, Actions, Views>
    | (() => ComponentSpec<Model, Actions, Views>)
): MemoryAdapterResult<Model, Actions, Views> {
  const spec =
    typeof componentOrFactory === 'function'
      ? componentOrFactory()
      : componentOrFactory;

  return createRuntime<MemoryAdapterResult<Model, Actions, Views>>((createAPI) => {
    // Initialize model
    const initialModel = spec.model({
      get: (): Model => {
        throw new Error('Cannot call get() during model initialization');
      },
      set: (): void => {
        throw new Error('Cannot call set() during model initialization');
      },
    });

    // Create model store
    const modelStore = createStore<Model>(initialModel);

    // Re-execute model factory with real store tools
    const model = spec.model({
      get: () => modelStore.get(),
      set: (updates) => {
        const current = modelStore.get();
        modelStore.set({ ...current, ...updates });
      },
    });

    modelStore.set(model);

    // Create the API with our implementations
    const api = createAPI({
      executeSlice: <T>(slice: SliceFactory<Model, T>): T => {
        const state = modelStore.get();
        return slice(state, api);
      },
      getState: () => modelStore.get(),
    });

    // Execute the component with the API
    return executeComponent(spec, api, modelStore);
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

  describe('Memory Adapter - Final Implementation', () => {
    it('should execute a basic component', () => {
      const counter = createComponent(() => {
        const model = createModel<{ count: number; increment: () => void }>(
          ({ set, get }) => ({
            count: 0,
            increment: () => set({ count: get().count + 1 }),
          })
        );

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const adapter = createMemoryAdapter(counter);

      expect(adapter.getState().count).toBe(0);
      expect(adapter.views.count().value).toBe(0);

      adapter.actions.increment();

      expect(adapter.getState().count).toBe(1);
      expect(adapter.views.count().value).toBe(1);
    });

    it('should handle actions that use executeSlice', () => {
      const counter = createComponent(() => {
        const model = createModel<{ count: number }>(() => ({ count: 5 }));
        const actions = createSlice(model, (_m, api) => ({
          // Action that uses executeSlice
          doubleCount: () => {
            const doubled = api.executeSlice(createSlice(model, (m) => m.count * 2));
            return doubled;
          }
        }));
        const views = {
          count: createSlice(model, (m) => m.count),
        };
        return { model, actions, views };
      });

      const adapter = createMemoryAdapter(counter);

      // Initial count
      expect(adapter.views.count()).toBe(5);
      
      // Action uses executeSlice internally
      const doubled = adapter.actions.doubleCount();
      expect(doubled).toBe(10);
    });

    it('should handle slice composition', () => {
      const component = createComponent(() => {
        const model = createModel<{
          user: { name: string };
          theme: string;
        }>(() => ({
          user: { name: 'Alice' },
          theme: 'light',
        }));

        const userSlice = createSlice(model, (m) => ({
          name: m.user.name,
        }));

        const themeSlice = createSlice(model, (m) => ({
          theme: m.theme,
        }));

        const headerSlice = createSlice(
          model,
          compose(
            { userSlice, themeSlice },
            (_, { userSlice, themeSlice }) => ({
              userName: userSlice.name,
              theme: themeSlice.theme,
              title: `${userSlice.name} - ${themeSlice.theme}`,
            })
          )
        );

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            header: headerSlice,
          },
        };
      });

      const adapter = createMemoryAdapter(component);
      const header = adapter.views.header();

      expect(header.userName).toBe('Alice');
      expect(header.theme).toBe('light');
      expect(header.title).toBe('Alice - light');
    });
  });
}