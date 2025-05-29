import type {
  ComponentFactory,
  SliceFactory,
} from '@lattice/core';
import { SELECT_MARKER, SLICE_FACTORY_MARKER } from '@lattice/core';

// Core adapter interfaces
interface Store<T> {
  get: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  subscribe: (listener: (value: T) => void) => () => void;
  destroy?: () => void;
}

interface AdapterPrimitives {
  createStore<T>(initial: T): Store<T>;
  createSlice<T, U>(store: Store<T>, selector: (state: T) => U): Store<U>;
}


// Result type for executed components
// Note: View types require type assertions due to the dynamic nature of view execution
export interface ExecuteResult<Model, Actions> {
  model: Store<Model>;
  actions: Store<Actions>;
  views: Record<string, unknown>;
}

/**
 * Creates an in-memory adapter for Lattice slice factories.
 * This adapter provides a simple state management solution without external dependencies.
 */
export function createMemoryAdapter() {
  // Implement adapter primitives
  const primitives: AdapterPrimitives = {
    createStore<T>(initial: T): Store<T> {
      let state = initial;
      const listeners = new Set<(value: T) => void>();

      return {
        get: () => state,
        set: (value: T | ((prev: T) => T)) => {
          state =
            typeof value === 'function'
              ? (value as (prev: T) => T)(state)
              : value;
          listeners.forEach((listener) => listener(state));
        },
        subscribe: (listener: (value: T) => void) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
    },

    createSlice<T, U>(store: Store<T>, selector: (state: T) => U): Store<U> {
      let cachedValue = selector(store.get());
      const listeners = new Set<(value: U) => void>();

      // Subscribe to parent store changes
      const unsubscribe = store.subscribe((state) => {
        const newValue = selector(state);
        // Only notify if value actually changed (simple equality check)
        if (newValue !== cachedValue) {
          cachedValue = newValue;
          listeners.forEach((listener) => listener(newValue));
        }
      });

      return {
        get: () => selector(store.get()),
        set: () => {
          // Slices are read-only
          throw new Error(
            'Cannot set value on a slice - slices are read-only projections'
          );
        },
        subscribe: (listener: (value: U) => void) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        destroy: () => {
          unsubscribe();
          listeners.clear();
        },
      };
    },
  };

  // Helper to resolve select() markers
  function resolveSelectMarkers<T, Model>(
    obj: T,
    sliceMap: Map<SliceFactory<Model, unknown>, Store<unknown>>,
    modelStore: Store<Model>
  ): T {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Check if this is a select marker
    if (typeof SELECT_MARKER !== 'undefined' && SELECT_MARKER in obj) {
      const sliceFactory = (obj as Record<symbol, unknown>)[
        SELECT_MARKER
      ] as SliceFactory<Model, unknown>;
      let slice = sliceMap.get(sliceFactory);

      // If slice doesn't exist yet, create it
      if (!slice) {
        slice = primitives.createSlice(modelStore, (state) => {
          const rawResult = sliceFactory(state);
          return resolveSelectMarkers(rawResult, sliceMap, modelStore);
        });
        sliceMap.set(sliceFactory, slice);
      }

      return slice.get() as T;
    }

    // Recursively resolve nested objects
    const resolved = Array.isArray(obj) ? [] : ({} as Record<string, unknown>);
    const source = obj as Record<string, unknown>;
    for (const key in source) {
      (resolved as Record<string, unknown>)[key] = resolveSelectMarkers(
        source[key],
        sliceMap,
        modelStore
      );
    }
    return resolved as T;
  }

  // Execute component - users should use type assertions or the primitives directly for full type safety
  function executeComponent<
    Model,
    Actions,
    Views extends Record<
      string,
      SliceFactory<Model, unknown> | (() => SliceFactory<Model, unknown>)
    >,
  >(
    componentFactory: ComponentFactory<Model, Actions, Views>
  ): ExecuteResult<Model, Actions> {
    const spec = componentFactory();

    // 1. Create reactive model
    const modelStore = primitives.createStore({} as Model);
    const model = spec.model({
      get: () => modelStore.get(),
      set: (updates) => modelStore.set((prev) => ({ ...prev, ...updates })),
    });
    modelStore.set(model);

    // Track created slices for select() resolution
    const sliceMap = new Map<SliceFactory<Model, unknown>, Store<unknown>>();

    // Helper to create a slice with select() support
    function createSliceWithSelect<T>(
      sliceFactory: SliceFactory<Model, T>
    ): Store<T> {
      const slice = primitives.createSlice(modelStore, (state) => {
        const rawResult = sliceFactory(state);
        return resolveSelectMarkers<T, Model>(rawResult, sliceMap, modelStore);
      });
      sliceMap.set(sliceFactory, slice as Store<unknown>);
      return slice;
    }

    // 2. Create reactive actions slice
    const actions = createSliceWithSelect(spec.actions);

    // 3. Handle views
    const views: Record<string, unknown> = {};

    // Process each view
    Object.keys(spec.views).forEach((key) => {
      const view = spec.views[key];

      if (typeof view === 'function') {
        // Check if it's a SliceFactory using the brand
        if (SLICE_FACTORY_MARKER in view) {
          // Static slice view
          views[key] = createSliceWithSelect(
            view as SliceFactory<Model, unknown>
          );
        } else {
          // Computed view - function that returns a SliceFactory
          views[key] = () => {
            const sliceFactory = (view as () => SliceFactory<Model, unknown>)();
            return createSliceWithSelect(sliceFactory);
          };
        }
      }
    });

    return { model: modelStore, actions, views };
  }


  // Return adapter with all methods
  // Type-safe builder for creating stores from slices
  function createStoreFromSlice<Model, Slice>(
    modelStore: Store<Model>,
    sliceFactory: SliceFactory<Model, Slice>
  ): Store<Slice> {
    return primitives.createSlice(modelStore, (state) => {
      const rawResult = sliceFactory(state);
      return resolveSelectMarkers<Slice, Model>(
        rawResult,
        new Map<SliceFactory<Model, unknown>, Store<unknown>>(),
        modelStore
      );
    });
  }

  // Return adapter API focused on primitives
  return {
    primitives,
    executeComponent,
    createStoreFromSlice
  };
}

// In-source tests
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createComponent, createModel, createSlice, select } = await import(
    '@lattice/core'
  );

  describe('createMemoryAdapter - primitives', () => {
    it('should provide working createStore primitive', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ count: 0, name: 'test' });
      
      expect(store.get()).toEqual({ count: 0, name: 'test' });
      
      store.set({ count: 5, name: 'updated' });
      expect(store.get()).toEqual({ count: 5, name: 'updated' });
    });

    it('should provide working createSlice primitive', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      
      const store = primitives.createStore({ count: 0, name: 'test' });
      const slice = primitives.createSlice(store, state => ({ count: state.count }));
      
      expect(slice.get()).toEqual({ count: 0 });
      
      // Update parent store
      store.set({ count: 5, name: 'updated' });
      expect(slice.get()).toEqual({ count: 5 });
    });

    it('should handle multiple subscribers independently', () => {
      const adapter = createMemoryAdapter();
      const { primitives } = adapter;
      const store = primitives.createStore({ value: 0 });

      const calls1: { value: number }[] = [];
      const calls2: { value: number }[] = [];

      const unsub1 = store.subscribe((state) => calls1.push(state));
      store.subscribe((state) => calls2.push(state));

      store.set({ value: 1 });

      expect(calls1.length).toBe(1);
      expect(calls2.length).toBe(1);
      expect(calls1[0]?.value).toBe(1);
      expect(calls2[0]?.value).toBe(1);

      // Unsubscribe first listener
      unsub1();
      store.set({ value: 2 });

      expect(calls1.length).toBe(1); // No new calls
      expect(calls2.length).toBe(2); // Still receiving updates
    });
  });

  describe('createMemoryAdapter - slice execution', () => {
    it('should understand slice factory branding', () => {
      const model = createModel<{ value: number }>(() => ({ value: 42 }));
      const slice = createSlice(model, (m) => ({ val: m.value }));

      // SliceFactory should have the marker
      expect(SLICE_FACTORY_MARKER in slice).toBe(true);

      // A function that returns a SliceFactory should not have the marker
      const computedView = () => slice;
      expect(SLICE_FACTORY_MARKER in computedView).toBe(false);

      // A transformed slice should also have the marker
      const transformed = slice((s) => ({ doubled: s.val * 2 }));
      expect(SLICE_FACTORY_MARKER in transformed).toBe(true);

      // The pattern from the computed view test
      const countSlice = createSlice(model, (m) => ({ count: m.value }));
      const counterView = () =>
        countSlice((state) => ({
          'data-count': state.count,
          className: state.count % 2 === 0 ? 'even' : 'odd',
        }));

      // counterView is a function without marker
      expect(SLICE_FACTORY_MARKER in counterView).toBe(false);

      // Calling counterView returns a SliceFactory with marker
      const innerSlice = counterView();
      expect(SLICE_FACTORY_MARKER in innerSlice).toBe(true);
      expect(typeof innerSlice).toBe('function');
    });

    it('should execute a simple component with model and actions', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        return { model, actions, views: {} };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(counter);

      // Verify structure
      expect(result.model).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.views).toBeDefined();

      // Model should be reactive
      expect(result.model.get().count).toBe(0);

      // Actions should work
      result.actions.get().increment();
      expect(result.model.get().count).toBe(1);
    });

    it('should handle static slice views', () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          disabled: boolean;
        }>(() => ({
          count: 5,
          disabled: false,
        }));

        const displaySlice = createSlice(model, (m) => ({
          value: m.count,
          isDisabled: m.disabled,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { display: displaySlice },
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Static view should be a reactive store
      const display = result.views.display as Store<{
        value: number;
        isDisabled: boolean;
      }>;
      expect(display.get()).toEqual({
        value: 5,
        isDisabled: false,
      });
    });

    it('should handle computed view functions', () => {
      const component = createComponent(() => {
        const model = createModel<{ count: number }>(() => ({ count: 5 }));

        const countSlice = createSlice(model, (m) => ({
          count: m.count,
        }));

        const counterView = () =>
          countSlice((state) => ({
            'data-count': state.count,
            className: state.count % 2 === 0 ? 'even' : 'odd',
          }));

        const views = { counter: counterView };

        return {
          model,
          actions: createSlice(model, () => ({})),
          views,
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Computed view should be a function that returns a store
      expect(typeof result.views.counter).toBe('function');

      // Cast to the expected type
      const counter = result.views.counter as () => Store<{
        'data-count': number;
        className: string;
      }>;
      const counterStore = counter();
      expect(counterStore.get()).toEqual({
        'data-count': 5,
        className: 'odd',
      });
    });

    it('should handle select() markers in slices', () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        // Note: select(actions).increment returns undefined because we're accessing
        // a property on the marker object. Adapters need to store the whole select()
        const buttonSlice = createSlice(model, (m) => ({
          onClick: select(actions),
          count: m.count,
        }));

        return {
          model,
          actions,
          views: { button: buttonSlice },
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const button = result.views.button as Store<{
        onClick: { increment: () => void };
        count: number;
      }>;
      const buttonView = button.get();
      expect(buttonView.count).toBe(0);
      // onClick should be the resolved actions object
      expect(typeof buttonView.onClick).toBe('object');
      expect(typeof buttonView.onClick.increment).toBe('function');

      // Clicking should increment
      buttonView.onClick.increment();
      expect(result.model.get().count).toBe(1);
    });

    it('should update slices reactively when model changes', () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const countSlice = createSlice(model, (m) => ({
          value: m.count,
          doubled: m.count * 2,
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({ increment: m.increment })),
          views: { display: countSlice },
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Subscribe to view changes
      const viewChanges: { value: number; doubled: number }[] = [];
      const display = result.views.display as Store<{
        value: number;
        doubled: number;
      }>;
      display.subscribe((value) => viewChanges.push(value));

      // Initial state
      expect(display.get()).toEqual({ value: 0, doubled: 0 });

      // Update model
      result.model.get().increment();

      // View should update
      expect(display.get()).toEqual({ value: 1, doubled: 2 });
      expect(viewChanges).toHaveLength(1);
      expect(viewChanges[0]).toEqual({ value: 1, doubled: 2 });
    });
  });
}
