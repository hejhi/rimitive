/**
 * @fileoverview Memory adapter for Lattice
 *
 * This adapter provides a simple in-memory state management solution
 * that implements the Lattice adapter specification. It creates reactive
 * stores and slices without any external dependencies.
 *
 * Key features:
 * - Minimal implementation using only JavaScript primitives
 * - Full support for select() markers and slice composition
 * - Type-safe component execution
 * - Read-only slices with proper error messages
 */

import type { ComponentFactory, SliceFactory } from '@lattice/core';
import { SELECT_MARKER, SELECT_SELECTOR, SLICE_FACTORY_MARKER } from '@lattice/core';

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

/**
 * Adapter primitives - minimal interface for state management
 */
interface AdapterPrimitives {
  createStore<T>(initial: T): Store<T>;
  createSlice<T, U>(store: Store<T>, selector: (state: T) => U): Store<U>;
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Maps view types from slice factories to stores
 */
type ViewType<Model, T> = T extends () => SliceFactory<Model, infer S>
  ? () => Store<S>
  : T extends SliceFactory<Model, infer S>
    ? Store<S>
    : never;

/**
 * Maps all views in a component to their executed types
 */
type ExecutedViews<Model, Views> = {
  [K in keyof Views]: ViewType<Model, Views[K]>;
};

/**
 * Result of executing a component
 */
export interface ExecuteResult<Model, Actions, Views> {
  model: Store<Model>;
  actions: Store<Actions>;
  views: ExecutedViews<Model, Views>;
}

// ============================================================================
// Primitive Implementations
// ============================================================================

/**
 * Creates a basic reactive store
 */
function createBasicStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(value: T) => void>();

  return {
    get: () => state,
    set: (value: T | ((prev: T) => T)) => {
      // Handle both direct values and updater functions
      state =
        typeof value === 'function' ? (value as (prev: T) => T)(state) : value;
      listeners.forEach((listener) => listener(state));
    },
    subscribe: (listener: (value: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Creates a read-only slice of a store
 */
function createReadOnlySlice<T, U>(
  store: Store<T>,
  selector: (state: T) => U
): Store<U> {
  let cachedValue = selector(store.get());
  const listeners = new Set<(value: U) => void>();

  // Subscribe to parent store and only notify on actual changes
  const unsubscribe = store.subscribe((state) => {
    const newValue = selector(state);
    if (newValue !== cachedValue) {
      cachedValue = newValue;
      listeners.forEach((listener) => listener(newValue));
    }
  });

  return {
    get: () => selector(store.get()),
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

/**
 * Creates an in-memory adapter for Lattice slice factories.
 *
 * @returns An adapter with primitives and component execution methods
 *
 * @example
 * ```typescript
 * const adapter = createMemoryAdapter();
 * const result = adapter.executeComponent(myComponent);
 *
 * // Access reactive stores
 * console.log(result.model.get());
 * result.actions.get().doSomething();
 * ```
 */
export function createMemoryAdapter() {
  // ============================================================================
  // Architecture Overview:
  //
  // 1. Primitives: Basic reactive store and read-only slice implementations
  // 2. Select Resolution: Handles select() markers for slice composition
  // 3. Component Execution: Transforms slice factories into reactive stores
  // 4. Public API: Exposes primitives and high-level execution methods
  // ============================================================================

  // Create adapter primitives using our implementations
  const primitives: AdapterPrimitives = {
    createStore: createBasicStore,
    createSlice: createReadOnlySlice,
  };

  // ============================================================================
  // Select Marker Resolution
  // ============================================================================

  interface SelectMarkerObj<Model = any, T = any, U = T> {
    [SELECT_MARKER]: SliceFactory<Model, T>;
    [SELECT_SELECTOR]?: (value: T) => U;
  }

  function isSelectMarker<Model>(obj: unknown): obj is SelectMarkerObj<Model> {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      typeof SELECT_MARKER !== 'undefined' &&
      SELECT_MARKER in obj
    );
  }

  /**
   * Internal slice cache for select() resolution
   * Note: We use a WeakMap for better memory management and type erasure is necessary
   * here since we're storing heterogeneous slice types.
   */
  class SliceCache<Model> {
    private cache = new Map<SliceFactory<Model, unknown>, Store<unknown>>();

    get<T>(factory: SliceFactory<Model, T>): Store<T> | undefined {
      return this.cache.get(factory) as Store<T> | undefined;
    }

    set<T>(factory: SliceFactory<Model, T>, store: Store<T>): void {
      this.cache.set(factory, store as Store<unknown>);
    }
  }

  /**
   * Recursively resolves select() markers in slice results
   */
  function resolveSelectMarkers<T, Model>(
    obj: T,
    sliceCache: SliceCache<Model>,
    modelStore: Store<Model>
  ): T {
    // Primitives pass through unchanged
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Handle select() markers
    if (isSelectMarker<Model>(obj)) {
      const sliceFactory = obj[SELECT_MARKER];
      let slice = sliceCache.get(sliceFactory);

      if (!slice) {
        // Create slice lazily with recursive resolution
        slice = primitives.createSlice(modelStore, (state) => {
          const rawResult = sliceFactory(state);
          return resolveSelectMarkers(rawResult, sliceCache, modelStore);
        });
        sliceCache.set(sliceFactory, slice);
      }

      // Get the slice result
      const sliceResult = slice.get();

      // Apply selector if present
      if (SELECT_SELECTOR in obj && obj[SELECT_SELECTOR]) {
        return obj[SELECT_SELECTOR](sliceResult) as T;
      }

      return sliceResult as T;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) =>
        resolveSelectMarkers(item, sliceCache, modelStore)
      ) as T;
    }

    // Handle objects
    const resolved = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        resolved[key] = resolveSelectMarkers(obj[key], sliceCache, modelStore);
      }
    }
    return resolved;
  }

  // ============================================================================
  // Component Execution
  // ============================================================================

  /**
   * Creates a slice that automatically resolves select() markers
   */
  function createSliceWithSelectSupport<Model, T>(
    modelStore: Store<Model>,
    sliceFactory: SliceFactory<Model, T>,
    sliceCache: SliceCache<Model>
  ): Store<T> {
    const slice = primitives.createSlice(modelStore, (state) => {
      const rawResult = sliceFactory(state);
      return resolveSelectMarkers<T, Model>(rawResult, sliceCache, modelStore);
    });
    sliceCache.set(sliceFactory, slice);
    return slice;
  }

  /**
   * Checks if a function is a SliceFactory (has the brand)
   */
  function isSliceFactory(fn: unknown): fn is SliceFactory {
    return typeof fn === 'function' && SLICE_FACTORY_MARKER in fn;
  }

  /**
   * Processes views into reactive stores
   */
  function processViews<Model, Views>(
    spec: { views: Views },
    createSlice: <T>(factory: SliceFactory<Model, T>) => Store<T>
  ): ExecutedViews<Model, Views> {
    const views = {} as ExecutedViews<Model, Views>;

    for (const key in spec.views) {
      const view = spec.views[key];
      if (!view || typeof view !== 'function') continue;

      if (isSliceFactory(view)) {
        // Static slice view - execute immediately
        Object.defineProperty(views, key, {
          value: createSlice(view),
          enumerable: true,
          configurable: true,
        });
      } else {
        // Computed view - returns a function that creates the store
        Object.defineProperty(views, key, {
          value: () => {
            const sliceFactory = (view as () => SliceFactory<Model>)();
            return createSlice(sliceFactory);
          },
          enumerable: true,
          configurable: true,
        });
      }
    }

    return views;
  }

  /**
   * Executes a component factory into reactive stores
   */
  function executeComponent<
    Model,
    Actions,
    Views extends Record<
      string,
      SliceFactory<Model, unknown> | (() => SliceFactory<Model, unknown>)
    >,
  >(
    componentFactory: ComponentFactory<Model, Actions, Views>
  ): ExecuteResult<Model, Actions, Views> {
    const spec = componentFactory();

    // 1. Create model store
    const modelStore = primitives.createStore<Model>({} as Model);
    const model = spec.model({
      get: () => modelStore.get(),
      set: (updates) => modelStore.set((prev) => ({ ...prev, ...updates })),
    });
    modelStore.set(model);

    // 2. Set up slice tracking for select() resolution
    const sliceCache = new SliceCache<Model>();
    const createSlice = <T>(factory: SliceFactory<Model, T>) =>
      createSliceWithSelectSupport(modelStore, factory, sliceCache);

    // 3. Create actions and views
    const actions = createSlice(spec.actions);
    const views = processViews<Model, Views>(spec, createSlice);

    return { model: modelStore, actions, views };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Creates a store from a slice factory with select() support
   */
  function createStoreFromSlice<Model, Slice>(
    modelStore: Store<Model>,
    sliceFactory: SliceFactory<Model, Slice>
  ): Store<Slice> {
    const sliceCache = new SliceCache<Model>();
    return createSliceWithSelectSupport(modelStore, sliceFactory, sliceCache);
  }

  return {
    primitives,
    executeComponent,
    createStoreFromSlice,
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
      const slice = primitives.createSlice(store, (state) => ({
        count: state.count,
      }));

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
      const display = result.views.display;
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

      // Type should be inferred correctly
      const counter = result.views.counter;
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

      const button = result.views.button;
      const buttonView = button.get();
      expect(buttonView.count).toBe(0);
      // onClick should be the resolved actions object
      expect(typeof buttonView.onClick).toBe('object');
      expect(typeof buttonView.onClick.increment).toBe('function');

      // Clicking should increment
      buttonView.onClick.increment();
      expect(result.model.get().count).toBe(1);
    });

    it('should handle select() with selector function', () => {
      const component = createComponent(() => {
        const model = createModel<{
          user: { id: number; name: string; email: string };
          posts: Array<{ id: number; title: string; authorId: number }>;
        }>(() => ({
          user: { id: 1, name: 'Alice', email: 'alice@example.com' },
          posts: [
            { id: 1, title: 'First Post', authorId: 1 },
            { id: 2, title: 'Second Post', authorId: 1 },
          ],
        }));

        const userSlice = createSlice(model, (m) => m.user);
        const postsSlice = createSlice(model, (m) => m.posts);

        // Create a composite slice that uses select with selectors
        const profileSlice = createSlice(model, () => ({
          // Select only name from user slice
          userName: select(userSlice, (u) => u.name),
          // Select only post count from posts slice
          postCount: select(postsSlice, (p) => p.length),
          // Select full user object (no selector)
          fullUser: select(userSlice),
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { profile: profileSlice },
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const profile = result.views.profile;
      const profileView = profile.get();
      
      // Verify select with selector resolved correctly
      expect(profileView.userName).toBe('Alice');
      expect(profileView.postCount).toBe(2);
      
      // Verify select without selector resolved correctly
      expect(profileView.fullUser).toEqual({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com'
      });
    });

    it('should handle nested select() with selector', () => {
      const component = createComponent(() => {
        const model = createModel<{
          data: {
            items: Array<{ id: number; value: string; active: boolean }>;
            filter: 'all' | 'active';
          };
        }>(() => ({
          data: {
            items: [
              { id: 1, value: 'one', active: true },
              { id: 2, value: 'two', active: false },
              { id: 3, value: 'three', active: true },
            ],
            filter: 'all',
          },
        }));

        const dataSlice = createSlice(model, (m) => m.data);
        
        // Create slices with different selectors
        const statsSlice = createSlice(model, () => ({
          // Select active items only
          activeItems: select(dataSlice, (d) => 
            d.items.filter(item => item.active)
          ),
          // Select item count
          totalCount: select(dataSlice, (d) => d.items.length),
          // Complex selector with computation
          summary: select(dataSlice, (d) => {
            const active = d.items.filter(i => i.active).length;
            const total = d.items.length;
            return `${active} of ${total} active`;
          }),
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { stats: statsSlice },
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const stats = result.views.stats.get();
      
      // Verify selectors applied correctly
      expect(stats.activeItems).toHaveLength(2);
      expect(stats.activeItems[0]).toEqual({ id: 1, value: 'one', active: true });
      expect(stats.activeItems[1]).toEqual({ id: 3, value: 'three', active: true });
      
      expect(stats.totalCount).toBe(3);
      expect(stats.summary).toBe('2 of 3 active');
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
      const display = result.views.display;
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
