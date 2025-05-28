import type { 
  ModelFactory, 
  ModelTools, 
  ComponentFactory,
  SliceFactory
} from '@lattice/core';
import { SELECT_MARKER } from '@lattice/core';

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

interface MemoryStore<T> {
  getState: () => T;
  subscribe: (listener: (state: T) => void) => () => void;
}

// Legacy adapter type for backward compatibility
export type StateAdapter = <T>(factory: ModelFactory<T>) => MemoryStore<T>;

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
          state = typeof value === 'function' ? (value as (prev: T) => T)(state) : value;
          listeners.forEach(listener => listener(state));
        },
        subscribe: (listener: (value: T) => void) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        }
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
          listeners.forEach(listener => listener(newValue));
        }
      });

      return {
        get: () => selector(store.get()),
        set: () => {
          // Slices are read-only
          throw new Error('Cannot set value on a slice - slices are read-only projections');
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
        }
      };
    }
  };

  // Helper to resolve select() markers
  function resolveSelectMarkers(obj: any, sliceMap: Map<any, Store<any>>, modelStore: Store<any>): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Check if this is a select marker
    if (typeof SELECT_MARKER !== 'undefined' && SELECT_MARKER in obj) {
      const sliceFactory = obj[SELECT_MARKER];
      let slice = sliceMap.get(sliceFactory);
      
      // If slice doesn't exist yet, create it
      if (!slice) {
        slice = primitives.createSlice(modelStore, (state) => {
          const rawResult = sliceFactory(state);
          return resolveSelectMarkers(rawResult, sliceMap, modelStore);
        });
        sliceMap.set(sliceFactory, slice);
      }
      
      return slice.get();
    }

    // Recursively resolve nested objects
    const resolved: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      resolved[key] = resolveSelectMarkers(obj[key], sliceMap, modelStore);
    }
    return resolved;
  }

  // Execute component - views lose some type information
  // Users should use primitives directly for full type safety
  function executeComponent<Model, Actions, Views>(
    componentFactory: ComponentFactory<Model, Actions, Views>
  ): {
    model: Store<Model>;
    actions: Store<Actions>;
    views: Record<string, Store<unknown> | (() => Store<unknown>)>;
  } {
    const spec = componentFactory();
    
    // 1. Create reactive model
    const modelStore = primitives.createStore({} as Model);
    const model = spec.model({
      get: () => modelStore.get(),
      set: (updates) => modelStore.set(prev => ({ ...prev, ...updates }))
    });
    modelStore.set(model);

    // Track created slices for select() resolution
    const sliceMap = new Map<SliceFactory<any, any>, Store<any>>();

    // Helper to create a slice with select() support
    function createSliceWithSelect<T>(sliceFactory: SliceFactory<Model, T>): Store<T> {
      const slice = primitives.createSlice(modelStore, (state) => {
        const rawResult = sliceFactory(state);
        return resolveSelectMarkers(rawResult, sliceMap, modelStore);
      });
      sliceMap.set(sliceFactory, slice);
      return slice;
    }

    // 2. Create reactive actions slice
    const actions = createSliceWithSelect(spec.actions);

    // 3. Handle views
    const views: Record<string, Store<unknown> | (() => Store<unknown>)> = {};
    
    for (const key in spec.views) {
      const view = spec.views[key];
      
      if (typeof view === 'function') {
        // Check if it's a computed view (takes no arguments) or a static slice
        const argLength = view.length;
        
        if (argLength === 0) {
          // Computed view - returns a function that creates a slice
          views[key] = () => {
            const innerSliceFactory = (view as () => SliceFactory<Model, unknown>)();
            return createSliceWithSelect(innerSliceFactory);
          };
        } else {
          // Static slice view - already a SliceFactory
          views[key] = createSliceWithSelect(view as SliceFactory<Model, unknown>);
        }
      }
    }

    return { model: modelStore, actions, views };
  }

  // Legacy adapter function for backward compatibility
  const legacyAdapter: StateAdapter = function <T>(modelFactory: ModelFactory<T>): MemoryStore<T> {
    let state: T;
    const listeners = new Set<(state: T) => void>();

    // Tools for model factory
    const tools: ModelTools<T> = {
      set: (partial: Partial<T>) => {
        state = { ...state, ...partial };
        listeners.forEach(listener => listener(state));
      },
      get: () => state
    };

    // Execute model factory to create initial state
    state = modelFactory(tools);

    return {
      getState: () => state,
      subscribe: (listener: (state: T) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }
    };
  };

  // Return adapter with all methods
  return Object.assign(legacyAdapter, {
    primitives,
    executeComponent
  });
}

// In-source tests
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createComponent, createModel, createSlice, select } = await import('@lattice/core');

  describe('createMemoryAdapter - unit', () => {
    it('should handle nested state updates correctly', () => {
      interface NestedState {
        user: { name: string; age: number };
        settings: { theme: string };
        updateUserName: (name: string) => void;
        updateTheme: (theme: string) => void;
      }

      const nestedModelFactory: ModelFactory<NestedState> = ({ set, get }) => ({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
        updateUserName: (name: string) => 
          set({ user: { ...get().user, name } }),
        updateTheme: (theme: string) => 
          set({ settings: { theme } })
      });

      const adapter = createMemoryAdapter();
      const store = adapter(nestedModelFactory);

      // Initial state
      expect(store.getState().user.name).toBe('John');
      expect(store.getState().settings.theme).toBe('dark');

      // Update nested state
      store.getState().updateUserName('Jane');
      expect(store.getState().user.name).toBe('Jane');
      expect(store.getState().user.age).toBe(30); // Should preserve other properties

      // Update different part of state
      store.getState().updateTheme('light');
      expect(store.getState().settings.theme).toBe('light');
      expect(store.getState().user.name).toBe('Jane'); // Should preserve previous update
    });

    it('should handle multiple subscribers independently', () => {
      interface CounterState {
        value: number;
        increment: () => void;
      }

      const modelFactory: ModelFactory<CounterState> = ({ set }) => ({
        value: 0,
        increment: () => set({ value: 1 })
      });

      const adapter = createMemoryAdapter();
      const store = adapter(modelFactory);

      const calls1: CounterState[] = [];
      const calls2: CounterState[] = [];

      const unsub1 = store.subscribe((state) => calls1.push(state));
      store.subscribe((state) => calls2.push(state));

      store.getState().increment();

      expect(calls1.length).toBe(1);
      expect(calls2.length).toBe(1);
      expect(calls1[0]?.value).toBe(1);
      expect(calls2[0]?.value).toBe(1);

      // Unsubscribe first listener
      unsub1();
      store.getState().increment();

      expect(calls1.length).toBe(1); // No new calls
      expect(calls2.length).toBe(2); // Still receiving updates
    });

    it('should provide consistent state references', () => {
      interface ConsistencyState {
        value: number;
        checkGet: () => boolean;
      }

      const modelFactory: ModelFactory<ConsistencyState> = ({ get }) => ({
        value: 0,
        checkGet: () => {
          const state1 = get();
          const state2 = get();
          return state1 === state2;
        }
      });

      const adapter = createMemoryAdapter();
      const store = adapter(modelFactory);

      expect(store.getState().checkGet()).toBe(true);
    });
  });

  describe('createMemoryAdapter - slice execution', () => {
    it('should execute a simple component with model and actions', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 })
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment
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
          disabled: false
        }));

        const displaySlice = createSlice(model, (m) => ({
          value: m.count,
          isDisabled: m.disabled
        }));

        return { 
          model, 
          actions: createSlice(model, () => ({})),
          views: { display: displaySlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Static view should be a reactive store
      const display = result.views.display as Store<{ value: number; isDisabled: boolean }>;
      expect(display.get()).toEqual({
        value: 5,
        isDisabled: false
      });
    });

    it('should handle computed view functions', () => {
      const component = createComponent(() => {
        const model = createModel<{ count: number }>(() => ({ count: 5 }));

        const countSlice = createSlice(model, (m) => ({
          count: m.count
        }));

        const counterView = () => countSlice((state) => ({
          'data-count': state.count,
          className: state.count % 2 === 0 ? 'even' : 'odd'
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { counter: counterView }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Computed view should be a function that returns a store
      expect(typeof result.views.counter).toBe('function');
      const counterStore = (result.views.counter as () => Store<any>)();
      expect(counterStore.get()).toEqual({
        'data-count': 5,
        className: 'odd'
      });
    });

    it('should handle select() markers in slices', () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 })
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment
        }));

        // Note: select(actions).increment returns undefined because we're accessing
        // a property on the marker object. Adapters need to store the whole select()
        const buttonSlice = createSlice(model, (m) => ({
          onClick: select(actions),
          count: m.count
        }));

        return {
          model,
          actions,
          views: { button: buttonSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const button = result.views.button as Store<{ onClick: any; count: number }>;
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
          increment: () => set({ count: get().count + 1 })
        }));

        const countSlice = createSlice(model, (m) => ({
          value: m.count,
          doubled: m.count * 2
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({ increment: m.increment })),
          views: { display: countSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Subscribe to view changes
      const viewChanges: any[] = [];
      const display = result.views.display as Store<{ value: number; doubled: number }>;
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