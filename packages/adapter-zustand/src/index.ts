/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management,
 * implementing the Lattice adapter specification. It creates reactive
 * stores and slices using Zustand's powerful state management capabilities.
 *
 * Key features:
 * - Full Zustand integration with subscriptions and middleware support
 * - Full support for select() markers and slice composition
 * - Type-safe component execution
 * - Read-only slices with proper error messages
 */

import type { ComponentFactory, SliceFactory, SelectMarkerValue } from '@lattice/core';
import { SELECT_MARKER, SLICE_FACTORY_MARKER } from '@lattice/core';
import { createStore } from 'zustand';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for zustand adapter errors with helpful context
 */
export class ZustandAdapterError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operation: string;
      details?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    // If there's a cause error, use its message as the primary message
    const errorMessage = context.cause instanceof Error 
      ? context.cause.message 
      : message;
    
    super(errorMessage);
    this.name = 'ZustandAdapterError';
    
    // Capture stack trace first if needed
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ZustandAdapterError);
    }
    
    // Now modify the stack trace to include context
    if (context.cause instanceof Error && context.cause.stack) {
      // Inject context into the original stack trace
      const stackLines = context.cause.stack.split('\n');
      stackLines[0] = `${this.name}: ${errorMessage} [${context.operation}]`;
      this.stack = stackLines.join('\n');
    } else if (this.stack) {
      // Add context to our stack trace
      const stackLines = this.stack.split('\n');
      stackLines[0] = `${this.name}: ${errorMessage} [${context.operation}]`;
      this.stack = stackLines.join('\n');
    }
  }
}

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
 * Creates a Zustand-based reactive store
 */
function createZustandStore<T>(initial: T): Store<T> {
  // Create a Zustand store with the state
  const store = createStore<T>(() => initial);

  return {
    get: () => store.getState(),
    set: (value: T | ((prev: T) => T)) => {
      try {
        // Handle both direct values and updater functions
        if (typeof value === 'function') {
          store.setState((value as (prev: T) => T)(store.getState()));
        } else {
          store.setState(value);
        }
      } catch (error) {
        throw new ZustandAdapterError(
          'Failed to update store state',
          {
            operation: 'store.set',
            details: { 
              valueType: typeof value,
              isFunction: typeof value === 'function'
            },
            cause: error
          }
        );
      }
    },
    subscribe: (listener: (value: T) => void) => {
      // Zustand's subscribe returns an unsubscribe function
      return store.subscribe(listener);
    },
  };
}

/**
 * Creates a read-only slice of a store using Zustand subscription
 */
function createZustandSlice<T, U>(
  store: Store<T>,
  selector: (state: T) => U
): Store<U> {
  let cachedValue: U;
  try {
    cachedValue = selector(store.get());
  } catch (error) {
    throw new ZustandAdapterError(
      'Initial slice selector execution failed',
      {
        operation: 'createSlice.initial',
        details: { storeValue: store.get() },
        cause: error
      }
    );
  }
  const listeners = new Set<(value: U) => void>();

  // Subscribe to parent store and only notify on actual changes
  const unsubscribe = store.subscribe((state) => {
    try {
      const newValue = selector(state);
      if (newValue !== cachedValue) {
        cachedValue = newValue;
        listeners.forEach((listener) => {
          try {
            listener(newValue);
          } catch (error) {
            throw new ZustandAdapterError(
              'Slice subscription callback failed',
              {
                operation: 'slice.subscribe.callback',
                details: { sliceValue: newValue },
                cause: error
              }
            );
          }
        });
      }
    } catch (error) {
      if (error instanceof ZustandAdapterError) {
        throw error;
      }
      throw new ZustandAdapterError(
        'Slice selector failed during state update',
        {
          operation: 'slice.selector',
          details: { parentState: state },
          cause: error
        }
      );
    }
  });

  return {
    get: () => {
      try {
        return selector(store.get());
      } catch (error) {
        throw new ZustandAdapterError(
          'Slice selector failed during get',
          {
            operation: 'slice.get',
            details: { storeValue: store.get() },
            cause: error
          }
        );
      }
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

/**
 * Creates a Zustand adapter for Lattice slice factories.
 *
 * @returns An adapter with primitives and component execution methods
 *
 * @example
 * ```typescript
 * const adapter = createZustandAdapter();
 * const result = adapter.executeComponent(myComponent);
 *
 * // Access reactive stores
 * console.log(result.model.get());
 * result.actions.get().doSomething();
 * ```
 */
export function createZustandAdapter() {
  // ============================================================================
  // Architecture Overview:
  //
  // 1. Primitives: Basic reactive store and read-only slice implementations
  // 2. Select Resolution: Handles select() markers for slice composition
  // 3. Component Execution: Transforms slice factories into reactive stores
  // 4. Public API: Exposes primitives and high-level execution methods
  // ============================================================================

  // Create adapter primitives using Zustand implementations
  const primitives: AdapterPrimitives = {
    createStore: createZustandStore,
    createSlice: createZustandSlice,
  };

  // ============================================================================
  // Select Marker Resolution
  // ============================================================================

  interface SelectMarkerObj<Model = any, T = any, U = T> {
    [SELECT_MARKER]: SelectMarkerValue<Model, T, U>;
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
      const markerValue = obj[SELECT_MARKER];
      const sliceFactory = markerValue.slice;
      let slice = sliceCache.get(sliceFactory);

      if (!slice) {
        // Create slice lazily with recursive resolution
        try {
          slice = primitives.createSlice(modelStore, (state) => {
            const rawResult = sliceFactory(state);
            return resolveSelectMarkers(rawResult, sliceCache, modelStore);
          });
          sliceCache.set(sliceFactory, slice);
        } catch (error) {
          throw new ZustandAdapterError(
            'Failed to create slice for select() marker',
            {
              operation: 'resolveSelectMarkers.createSlice',
              details: { sliceFactory: sliceFactory.name || 'anonymous' },
              cause: error
            }
          );
        }
      }

      // Get the slice result
      let sliceResult: unknown;
      try {
        sliceResult = slice.get();
      } catch (error) {
        throw new ZustandAdapterError(
          'Failed to get value from slice in select() resolution',
          {
            operation: 'resolveSelectMarkers.getSlice',
            cause: error
          }
        );
      }

      // Apply selector if present
      if (markerValue.selector) {
        try {
          return markerValue.selector(sliceResult) as T;
        } catch (error) {
          throw new ZustandAdapterError(
            'Select marker selector function failed',
            {
              operation: 'resolveSelectMarkers.selector',
              details: { sliceResult },
              cause: error
            }
          );
        }
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
    try {
      const slice = primitives.createSlice(modelStore, (state) => {
        let rawResult: T;
        try {
          rawResult = sliceFactory(state);
        } catch (error) {
          throw new ZustandAdapterError(
            'Slice factory execution failed',
            {
              operation: 'createSliceWithSelectSupport.sliceFactory',
              details: { sliceFactory: sliceFactory.name || 'anonymous' },
              cause: error
            }
          );
        }
        return resolveSelectMarkers<T, Model>(rawResult, sliceCache, modelStore);
      });
      sliceCache.set(sliceFactory, slice);
      return slice;
    } catch (error) {
      if (error instanceof ZustandAdapterError) {
        throw error;
      }
      throw new ZustandAdapterError(
        'Failed to create slice with select support',
        {
          operation: 'createSliceWithSelectSupport',
          details: { sliceFactory: sliceFactory.name || 'anonymous' },
          cause: error
        }
      );
    }
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
        try {
          Object.defineProperty(views, key, {
            value: createSlice(view),
            enumerable: true,
            configurable: true,
          });
        } catch (error) {
          throw new ZustandAdapterError(
            `Failed to create static view "${String(key)}"`,
            {
              operation: 'processViews.staticView',
              details: { viewKey: String(key) },
              cause: error
            }
          );
        }
      } else {
        // Computed view - returns a function that creates the store
        Object.defineProperty(views, key, {
          value: () => {
            try {
              const sliceFactory = (view as () => SliceFactory<Model>)();
              return createSlice(sliceFactory);
            } catch (error) {
              throw new ZustandAdapterError(
                `Failed to create computed view "${String(key)}"`,
                {
                  operation: 'processViews.computedView',
                  details: { viewKey: String(key) },
                  cause: error
                }
              );
            }
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
    let spec: ReturnType<typeof componentFactory>;
    try {
      spec = componentFactory();
    } catch (error) {
      throw new ZustandAdapterError(
        'Component factory execution failed',
        {
          operation: 'executeComponent.componentFactory',
          cause: error
        }
      );
    }

    // 1. Create model store
    const modelStore = primitives.createStore<Model>({} as Model);
    
    let model: Model;
    try {
      model = spec.model({
        get: () => modelStore.get(),
        set: (updates) => modelStore.set((prev) => ({ ...prev, ...updates })),
      });
    } catch (error) {
      throw new ZustandAdapterError(
        'Model factory execution failed',
        {
          operation: 'executeComponent.modelFactory',
          cause: error
        }
      );
    }
    
    modelStore.set(model);

    // 2. Set up slice tracking for select() resolution
    const sliceCache = new SliceCache<Model>();
    const createSlice = <T>(factory: SliceFactory<Model, T>) =>
      createSliceWithSelectSupport(modelStore, factory, sliceCache);

    // 3. Create actions and views
    let actions: Store<Actions>;
    try {
      actions = createSlice(spec.actions);
    } catch (error) {
      throw new ZustandAdapterError(
        'Actions slice creation failed',
        {
          operation: 'executeComponent.actions',
          cause: error
        }
      );
    }
    
    let views: ExecutedViews<Model, Views>;
    try {
      views = processViews<Model, Views>(spec, createSlice);
    } catch (error) {
      throw new ZustandAdapterError(
        'Views processing failed',
        {
          operation: 'executeComponent.views',
          cause: error
        }
      );
    }

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

  describe('createZustandAdapter - primitives', () => {
    it('should provide working createStore primitive', () => {
      const adapter = createZustandAdapter();
      const { primitives } = adapter;

      const store = primitives.createStore({ count: 0, name: 'test' });

      expect(store.get()).toEqual({ count: 0, name: 'test' });

      store.set({ count: 5, name: 'updated' });
      expect(store.get()).toEqual({ count: 5, name: 'updated' });
    });

    it('should provide working createSlice primitive', () => {
      const adapter = createZustandAdapter();
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
      const adapter = createZustandAdapter();
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

  describe('createZustandAdapter - slice execution', () => {
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

      const adapter = createZustandAdapter();
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

      const adapter = createZustandAdapter();
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

      const adapter = createZustandAdapter();
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

      const adapter = createZustandAdapter();
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

      const adapter = createZustandAdapter();
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

      const adapter = createZustandAdapter();
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

      const adapter = createZustandAdapter();
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
