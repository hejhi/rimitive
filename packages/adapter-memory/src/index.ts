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

import type {
  ComponentSpec,
  AdapterResult,
  SliceFactory,
  ViewTypes,
  AdapterAPI,
} from '@lattice/core';
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

  // Create the AdapterAPI implementation
  const adapterApi: AdapterAPI<Model> = {
    executeSlice: <T>(slice: SliceFactory<Model, T>): T => {
      const state = modelStore.get();
      return slice(state, adapterApi);
    },
    getState: () => modelStore.get(),
  };

  // Type-safe slice executor
  const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
    const state = modelStore.get();
    return factory(state, adapterApi);
  };

  // Execute actions slice
  const actionsStore = createSlice(modelStore, () =>
    executeSliceFactory(spec.actions)
  );

  // Process views - use a more direct approach
  const viewStores: Array<Store<unknown>> = [];

  // Build the views object with proper typing
  const views = Object.entries(spec.views as Record<string, unknown>).reduce(
    (acc, [key, view]) => {
      if (isSliceFactory(view)) {
        // Static view: create a store and wrap in a function
        const viewStore = createSlice<Model, unknown>(modelStore, () =>
          executeSliceFactory(view)
        );
        viewStores.push(viewStore);

        // Create the view function
        acc[key as keyof ViewTypes<Model, Views>] = (() =>
          shallowCopy(viewStore.get())) as ViewTypes<
          Model,
          Views
        >[keyof ViewTypes<Model, Views>];
      } else if (typeof view === 'function') {
        // Computed view: wrap to inject API as last parameter
        acc[key as keyof ViewTypes<Model, Views>] = ((...args: unknown[]) => {
          // Call the view function with user args + api as last argument
          const result = view(...args, adapterApi);
          
          // If the result is a slice factory, execute it with the API
          if (isSliceFactory(result)) {
            const state = modelStore.get();
            return result(state, adapterApi);
          }
          
          // Otherwise return the result as-is
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

        const actions = createSlice(model, (m, _api) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m, _api) => ({ value: m.count })),
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

        const userSlice = createSlice(model, (m, _api) => ({
          name: m.user.name,
        }));

        const themeSlice = createSlice(model, (m, _api) => ({
          theme: m.theme,
        }));

        const headerSlice = createSlice(
          model,
          compose(
            { userSlice, themeSlice },
            (_, { userSlice, themeSlice }, _api) => ({
              userName: userSlice.name,
              theme: themeSlice.theme,
              title: `${userSlice.name} - ${themeSlice.theme}`,
            })
          )
        );

        return {
          model,
          actions: createSlice(model, (_m, _api) => ({})),
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

    it('should pass API to slices that use it', () => {
      const component = createComponent(() => {
        const model = createModel<{ count: number; name: string }>(() => ({
          count: 10,
          name: 'test',
        }));

        // Create a slice that uses the API
        const apiSlice = createSlice(model, (m, api) => ({
          count: m.count,
          hasApi: true,
          stateCount: api.getState().count,
          canExecuteSlices: typeof api.executeSlice === 'function',
        }));

        // Create another slice for the API to execute
        const targetSlice = createSlice(model, (m, _api) => ({
          doubled: m.count * 2,
        }));

        // Create a slice that uses API to execute another slice
        const composingSlice = createSlice(model, (_m, api) => {
          const target = api.executeSlice(targetSlice);
          return {
            fromTarget: target.doubled,
            fromApi: api.getState().count,
          };
        });

        return {
          model,
          actions: createSlice(model, (_m, _api) => ({})),
          views: {
            withApi: apiSlice,
            composed: composingSlice,
          },
        };
      });

      const adapter = createMemoryAdapter(component);
      
      // Test the API-aware slice
      const withApi = adapter.views.withApi();
      expect(withApi.count).toBe(10);
      expect(withApi.hasApi).toBe(true);
      expect(withApi.stateCount).toBe(10);
      expect(withApi.canExecuteSlices).toBe(true);

      // Test the composing slice
      const composed = adapter.views.composed();
      expect(composed.fromTarget).toBe(20); // 10 * 2
      expect(composed.fromApi).toBe(10);
    });

    it('should support computed views with API', () => {
      const component = createComponent(() => {
        const model = createModel<{ items: string[]; filter: string }>(() => ({
          items: ['apple', 'banana', 'cherry'],
          filter: 'a',
        }));

        // Base slice
        const itemsSlice = createSlice(model, (m, _api) => m.items);

        // Track if API was injected properly
        let apiWasInjected = false;
        let lastArgWasApi = false;

        // Computed view that returns a slice factory
        const filtered = function(this: any, ...args: any[]) {
          // Check if last argument is the API
          const lastArg = args[args.length - 1];
          lastArgWasApi = !!(lastArg && typeof lastArg.executeSlice === 'function' && typeof lastArg.getState === 'function');
          
          // Get the prefix if provided (excluding API)
          const prefix = lastArgWasApi && args.length > 1 ? args[0] : undefined;
          
          return createSlice(model, (m, sliceApi) => {
            apiWasInjected = true;
            // Use API to get items from another slice
            const items = sliceApi.executeSlice(itemsSlice);
            const filtered = items.filter(item => item.includes(m.filter));
            return prefix ? filtered.map(item => prefix + item) : filtered;
          });
        };

        return {
          model,
          actions: createSlice(model, (_m, _api) => ({})),
          views: {
            filtered: filtered as (prefix?: string) => any,
            // Add a view to check if API was injected
            apiCheck: () => ({ apiWasInjected, lastArgWasApi }),
          },
        };
      });

      const adapter = createMemoryAdapter(component);
      
      // Test without arguments
      const filtered = (adapter.views as any).filtered();
      expect(filtered).toEqual(['apple', 'banana']);
      
      // Check API was injected properly
      const check1 = (adapter.views as any).apiCheck();
      expect(check1.apiWasInjected).toBe(true);
      expect(check1.lastArgWasApi).toBe(true);
      
      // Test with arguments - the API should be injected as last parameter
      const prefixedFiltered = (adapter.views as any).filtered('fruit: ');
      expect(prefixedFiltered).toEqual(['fruit: apple', 'fruit: banana']);
      
      // Check API was still injected as last arg
      const check2 = (adapter.views as any).apiCheck();
      expect(check2.lastArgWasApi).toBe(true);
    });
  });
}
