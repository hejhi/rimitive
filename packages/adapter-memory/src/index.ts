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

import type { ComponentSpec, AdapterResult, SliceFactory } from '@lattice/core';
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
 * Executes a component specification with memory stores
 */
function executeComponent<Model, Actions, Views>(
  spec: ComponentSpec<Model, Actions, Views>
): MemoryAdapterResult<Model, Actions, Views> {
  // Create model store
  const modelStore = createStore<Model>({} as Model);

  // Execute model factory with store tools
  const model = spec.model({
    get: () => modelStore.get(),
    set: (updates) => {
      const current = modelStore.get();
      modelStore.set({ ...current, ...updates });
    },
  });

  // Initialize model store with factory result
  modelStore.set(model);

  // Helper to execute a slice factory
  const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
    const state = modelStore.get();
    let rawResult = factory(state);

    // If the result is itself a slice factory, execute it
    if (isSliceFactory<Model, T>(rawResult)) {
      rawResult = executeSliceFactory(rawResult);
    }

    return rawResult;
  };

  // Execute actions slice
  const actionsStore = createSlice(modelStore, () =>
    executeSliceFactory(spec.actions)
  );

  // Process views
  const views: any = {};
  const viewStores: Store<any>[] = [];

  for (const [key, view] of Object.entries(
    spec.views as Record<string, unknown>
  )) {
    if (isSliceFactory(view)) {
      // Static view: slice factory
      const viewStore = createSlice(modelStore, () =>
        executeSliceFactory(view)
      );
      viewStores.push(viewStore);

      // Wrap as function that returns current value
      // Always return a new object to ensure fresh references
      views[key] = () => {
        const value = viewStore.get();
        // Return a shallow copy to ensure different object references
        return typeof value === 'object' && value !== null
          ? Array.isArray(value)
            ? [...value]
            : { ...value }
          : value;
      };
    } else if (typeof view === 'function') {
      // Already a function, use as-is
      views[key] = view;
    }
  }

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
