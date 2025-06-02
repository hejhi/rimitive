/**
 * @fileoverview Memory adapter for Lattice
 *
 * This adapter provides a simple in-memory state management solution
 * that implements the Lattice adapter specification. It creates reactive
 * stores and slices without any external dependencies.
 *
 * Key features:
 * - Minimal implementation using only JavaScript primitives
 * - Full support for compose() and slice composition
 * - Type-safe component execution
 * - Read-only slices with proper error messages
 */

import type { ComponentSpec, AdapterResult, SliceFactory, ViewTypes } from '@lattice/core';
import { isSliceFactory } from '@lattice/core';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Store interface - the fundamental reactive primitive
 */
interface Store<T> {
  get: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  subscribe: (listener: (value: T) => void) => () => void;
  destroy?: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Creates a basic reactive store using closure
 */
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

/**
 * Creates a read-only slice that derives state from another store
 */
function createSlice<T, U>(
  store: Store<T>,
  selector: (state: T) => U
): Store<U> {
  const listeners = new Set<(value: U) => void>();
  let cache: { value: U; state: T } | undefined;

  // Subscribe to parent store
  const unsubscribe = store.subscribe((state) => {
    const newValue = selector(state);

    // Only notify if value changed
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

// ============================================================================
// Memory Adapter Result
// ============================================================================

/**
 * The result returned by the memory adapter
 */
export interface MemoryAdapterResult<Model, Actions, Views>
  extends AdapterResult<Model, Actions, Views> {
  /**
   * Get the current state (for testing)
   */
  getState: () => Model;

  /**
   * Destroy all stores and clean up subscriptions
   */
  destroy: () => void;
}

// ============================================================================
// Component Execution
// ============================================================================

/**
 * Creates a shallow copy of a value to ensure fresh references
 */
function shallowCopy<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return [...value] as T;
  }
  return { ...value };
}

/**
 * Executes a component specification with memory stores
 */
function executeComponent<Model, Actions, Views>(
  spec: ComponentSpec<Model, Actions, Views>
): MemoryAdapterResult<Model, Actions, Views> {
  // Execute model factory to get initial state
  const initialModel = spec.model({
    get: (): Model => {
      throw new Error('Cannot call get() during model initialization');
    },
    set: (): void => {
      throw new Error('Cannot call set() during model initialization');
    },
  });

  // Create model store with proper initial state
  const modelStore = createStore<Model>(initialModel);

  // Re-execute model factory with real store tools
  const model = spec.model({
    get: () => modelStore.get(),
    set: (updates) => {
      const current = modelStore.get();
      modelStore.set({ ...current, ...updates });
    },
  });

  // Update model store with fully initialized model
  modelStore.set(model);

  // Type-safe slice executor
  const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
    const state = modelStore.get();
    const result = factory(state);

    // Handle nested slice factories (from transform syntax)
    if (isSliceFactory(result)) {
      // TypeScript can't narrow the type here, but we know it's safe
      return executeSliceFactory(result as SliceFactory<Model, T>);
    }

    return result;
  };

  // Execute actions slice
  const actionsStore = createSlice(modelStore, () =>
    executeSliceFactory(spec.actions)
  );

  // Process views - use a more direct approach
  const viewStores: Array<Store<unknown>> = [];
  
  // Build the views object with proper typing
  const views = Object.entries(spec.views as Record<string, unknown>).reduce((acc, [key, view]) => {
    if (isSliceFactory(view)) {
      // Static view: create a store and wrap in a function
      const viewStore = createSlice(modelStore, () =>
        executeSliceFactory(view as SliceFactory<Model, unknown>)
      );
      viewStores.push(viewStore);
      
      // Create the view function
      acc[key as keyof ViewTypes<Model, Views>] = (() => 
        shallowCopy(viewStore.get())
      ) as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
    } else if (typeof view === 'function') {
      // Function view: use as-is
      acc[key as keyof ViewTypes<Model, Views>] = view as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
    }
    
    return acc;
  }, {} as ViewTypes<Model, Views>);

  return {
    actions: actionsStore.get(),
    views,
    getState: () => modelStore.get(),
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
 * Creates a memory adapter for Lattice components
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

  return executeComponent(spec);
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createComponent, createModel, createSlice, compose } = await import(
    '@lattice/core'
  );

  describe('Memory Adapter', () => {
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

    it('should handle slice composition with compose()', () => {
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
