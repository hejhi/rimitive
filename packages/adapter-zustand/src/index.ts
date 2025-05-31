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
 * - Auto-generating selectors pattern for clean API
 * - No namespace collision between model state and adapter properties
 */

import type {
  ComponentFactory,
  SliceFactory,
  SelectMarkerValue,
} from '@lattice/core';
import { SELECT_MARKER, SLICE_FACTORY_MARKER } from '@lattice/core';
import { createStore, StoreApi } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';

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
    const errorMessage =
      context.cause instanceof Error ? context.cause.message : message;

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
export interface Store<T> {
  get: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  subscribe: (listener: (value: T) => void) => () => void;
  destroy?: () => void;
}

/**
 * Maps view types from slice factories to functions that return view attributes
 */
type ViewType<Model, T> = T extends () => SliceFactory<Model, infer S>
  ? () => S
  : T extends SliceFactory<Model, infer S>
    ? () => S
    : never;

/**
 * Maps all views in a component to their types
 */
type ViewTypes<Model, Views> = {
  [K in keyof Views]: ViewType<Model, Views[K]>;
};

/**
 * Subscription callback type
 */
type SubscribeCallback<T> = (value: T) => void;

/**
 * View subscription function type
 */
type ViewSubscribe<Views> = <Selected>(
  selector: (views: Views) => Selected,
  callback: SubscribeCallback<Selected>
) => () => void;

/**
 * Result of executing a component with the zustand adapter
 */
export interface ZustandAdapterResult<Model, Actions, Views> {
  /**
   * Subscribe to view changes
   * @example
   * const unsub = store.subscribe(
   *   views => ({ button: views.button(), count: views.counter() }),
   *   state => console.log('Views changed:', state)
   * );
   */
  subscribe: ViewSubscribe<ViewTypes<Model, Views>>;

  /**
   * Actions object with all action methods
   * @example
   * store.actions.increment();
   * store.actions.decrement();
   */
  actions: Actions;

  /**
   * View functions - each returns the view attributes
   * @example
   * const attrs = store.views.display(); // Returns view attributes
   * const buttonAttrs = store.views.button(); // Returns UI attributes
   */
  views: ViewTypes<Model, Views>;
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Type for a Zustand store enhanced with subscribeWithSelector middleware
 */
type StoreWithSelector<T> = StoreApi<T> & {
  subscribe: {
    (listener: (state: T, prevState: T) => void): () => void;
    <U>(
      selector: (state: T) => U,
      listener: (state: U, prevState: U) => void,
      options?: {
        equalityFn?: (a: U, b: U) => boolean;
        fireImmediately?: boolean;
      }
    ): () => void;
  };
};

// Default type parameters are needed for TypeScript inference in resolveSelectMarkers
interface SelectMarkerObj<Model, T = unknown, U = unknown> {
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
 * Checks if a function is a SliceFactory (has the brand)
 */
function isSliceFactory(fn: unknown): fn is SliceFactory {
  return typeof fn === 'function' && SLICE_FACTORY_MARKER in fn;
}

// ============================================================================
// Primitive Implementations
// ============================================================================

/**
 * Creates a read-only slice of a store using Zustand's selector subscription
 */
function createZustandSlice<T, U>(
  store: StoreWithSelector<T>,
  selector: (state: T) => U
): Store<U> {
  // Let Zustand handle all the change detection and subscription logic
  return {
    get: () => {
      try {
        return selector(store.getState());
      } catch (error) {
        throw new ZustandAdapterError('Slice selector failed during get', {
          operation: 'slice.get',
          details: { storeValue: store.getState() },
          cause: error,
        });
      }
    },
    set: () => {
      throw new Error(
        'Cannot set value on a slice - slices are read-only projections'
      );
    },
    subscribe: (listener: (value: U) => void) => {
      // Use Zustand's built-in selector subscription
      // It handles change detection, equality checks, and only calls
      // the listener when the selected value actually changes
      try {
        return store.subscribe(selector, (state) => listener(state));
      } catch (error) {
        throw new ZustandAdapterError('Slice subscription failed', {
          operation: 'slice.subscribe',
          cause: error,
        });
      }
    },
  };
}

// ============================================================================
// Supporting Types and Functions
// ============================================================================

/**
 * Internal slice cache for select() resolution
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
  modelStore: Store<Model>,
  zustandStore: StoreWithSelector<Model>
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
        slice = createZustandSlice(zustandStore, (state) => {
          const rawResult = sliceFactory(state);
          return resolveSelectMarkers(
            rawResult,
            sliceCache,
            modelStore,
            zustandStore
          );
        });
        sliceCache.set(sliceFactory, slice);
      } catch (error) {
        throw new ZustandAdapterError(
          'Failed to create slice for select() marker',
          {
            operation: 'resolveSelectMarkers.createSlice',
            details: { sliceFactory: sliceFactory.name || 'anonymous' },
            cause: error,
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
          cause: error,
        }
      );
    }

    // Apply selector if present
    if (markerValue.selector) {
      try {
        const selected = markerValue.selector(sliceResult);
        return selected as T;
      } catch (error) {
        throw new ZustandAdapterError(
          'Select marker selector function failed',
          {
            operation: 'resolveSelectMarkers.selector',
            details: { sliceResult },
            cause: error,
          }
        );
      }
    }

    return sliceResult as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      resolveSelectMarkers(item, sliceCache, modelStore, zustandStore)
    ) as T;
  }

  // Handle objects
  const resolved = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      resolved[key] = resolveSelectMarkers(
        obj[key],
        sliceCache,
        modelStore,
        zustandStore
      );
    }
  }
  return resolved;
}

/**
 * Creates a slice that automatically resolves select() markers
 */
function createSliceWithSelectSupport<Model, T>(
  modelStore: Store<Model>,
  zustandStore: StoreWithSelector<Model>,
  sliceFactory: SliceFactory<Model, T>,
  sliceCache: SliceCache<Model>
): Store<T> {
  try {
    const slice = createZustandSlice(zustandStore, (state) => {
      let rawResult: T;
      try {
        rawResult = sliceFactory(state);
      } catch (error) {
        throw new ZustandAdapterError('Slice factory execution failed', {
          operation: 'createSliceWithSelectSupport.sliceFactory',
          details: { sliceFactory: sliceFactory.name || 'anonymous' },
          cause: error,
        });
      }
      return resolveSelectMarkers<T, Model>(
        rawResult,
        sliceCache,
        modelStore,
        zustandStore
      );
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
        cause: error,
      }
    );
  }
}

/**
 * Processes views into functions that return view attributes
 */
function processViews<Model, Views>(
  spec: { views: Views },
  modelStore: Store<Model>,
  zustandStore: StoreWithSelector<Model>,
  sliceCache: SliceCache<Model>
): ViewTypes<Model, Views> {
  const views = {} as ViewTypes<Model, Views>;

  for (const key in spec.views) {
    const view = spec.views[key];
    if (!view || typeof view !== 'function') continue;

    if (isSliceFactory(view)) {
      // Static slice view - create a hook that returns view attributes
      const viewSlice = createSliceWithSelectSupport(
        modelStore,
        zustandStore,
        view,
        sliceCache
      );

      Object.defineProperty(views, key, {
        value: () => viewSlice.get(),
        enumerable: true,
        configurable: true,
      });
    } else {
      // Computed view - create a hook that computes and returns view attributes
      Object.defineProperty(views, key, {
        value: () => {
          try {
            const sliceFactory = (view as () => SliceFactory<Model>)();
            const viewSlice = createSliceWithSelectSupport(
              modelStore,
              zustandStore,
              sliceFactory,
              sliceCache
            );
            return viewSlice.get();
          } catch (error) {
            throw new ZustandAdapterError(
              `Failed to compute view "${String(key)}"`,
              {
                operation: 'processViews.computedView',
                details: { viewKey: String(key) },
                cause: error,
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
 * Creates a Zustand adapter for a Lattice component with a unified API
 * that maintains proper abstraction boundaries.
 *
 * The adapter returns an object with:
 * - `actions`: Direct access to all action methods
 * - `views`: Functions that return view attributes
 * - `subscribe`: View-based subscriptions for reactive updates
 *
 * @param componentFactory - The Lattice component factory
 * @returns An adapter result with actions, views, and subscribe
 *
 * @remarks
 * - Model state is kept private - only accessible through views
 * - Actions are regular functions, not hooks
 * - Views are functions that return current attributes
 * - Subscriptions work at the view level, not model level
 */
export function createZustandAdapter<
  Model,
  Actions,
  Views extends Record<
    string,
    SliceFactory<Model, unknown> | (() => SliceFactory<Model, unknown>)
  >,
>(
  componentFactory: ComponentFactory<Model, Actions, Views>
): ZustandAdapterResult<Model, Actions, Views> {
  // Execute the component factory to get the specification
  let spec: ReturnType<typeof componentFactory>;
  try {
    spec = componentFactory();
  } catch (error) {
    throw new ZustandAdapterError('Component factory execution failed', {
      operation: 'createZustandAdapter.componentFactory',
      cause: error,
    });
  }

  // Create the Zustand store with subscribeWithSelector middleware
  const store: StoreWithSelector<Model> = createStore<Model>()(
    subscribeWithSelector((set, get) => {
      // Execute the model factory with Zustand's set/get
      let model: Model;
      try {
        model = spec.model({ set, get });
      } catch (error) {
        throw new ZustandAdapterError('Model factory execution failed', {
          operation: 'createZustandAdapter.modelFactory',
          cause: error,
        });
      }

      return model;
    })
  );

  // Create a store interface for internal use
  const modelStore: Store<Model> = {
    get: () => store.getState(),
    set: (value) => {
      if (typeof value === 'function') {
        store.setState((state) => (value as (prev: Model) => Model)(state));
      } else {
        store.setState(value);
      }
    },
    subscribe: (listener) => store.subscribe(listener),
  };

  // Set up slice tracking for select() resolution
  const sliceCache = new SliceCache<Model>();

  // Process actions slice
  let actionsSlice: Store<Actions>;
  try {
    actionsSlice = createSliceWithSelectSupport(
      modelStore,
      store,
      spec.actions,
      sliceCache
    );
  } catch (error) {
    throw new ZustandAdapterError('Actions slice creation failed', {
      operation: 'createZustandAdapter.actions',
      cause: error,
    });
  }

  // Process views
  let views: ViewTypes<Model, Views>;
  try {
    views = processViews<Model, Views>(spec, modelStore, store, sliceCache);
  } catch (error) {
    throw new ZustandAdapterError('Views processing failed', {
      operation: 'createZustandAdapter.views',
      cause: error,
    });
  }

  // Create the unified API
  return {
    // Clean actions API - just the actions object
    actions: actionsSlice.get(),

    // Views API - functions that return view attributes
    views,

    // View-based subscription API
    subscribe: <Selected>(
      selector: (views: ViewTypes<Model, Views>) => Selected,
      callback: SubscribeCallback<Selected>
    ) => {
      // Create a selector that passes views directly
      // JavaScript's lazy evaluation means only the views accessed
      // by the selector will be computed. For example:
      // - selector: views => views.counter() - only computes counter
      // - selector: views => ({ a: views.a(), b: views.b() }) - only computes a and b
      const viewSelector = (_state: Model) => selector(views);

      // Use zustand's subscribeWithSelector
      // It will:
      // 1. Run the selector (which calls only needed view functions)
      // 2. Compare the result with the previous result
      // 3. Only call the callback if the result changed
      return store.subscribe(viewSelector, callback);
    },
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

  describe('createZustandAdapter - unified API', () => {
    it('should return actions, views, and subscribe', () => {
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

      const store = createZustandAdapter(counter);

      expect(store).toBeDefined();
      expect(typeof store.subscribe).toBe('function');
      expect(store.actions).toBeDefined();
      expect(store.views).toBeDefined();

      // Should not expose internal store methods
      // @ts-expect-error
      expect(store.getState).toBeUndefined();
      // @ts-expect-error
      expect(store.setState).toBeUndefined();
      // @ts-expect-error
      expect(store.use).toBeUndefined();
    });

    it('should access state through views', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          multiplier: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          multiplier: 2,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const stateView = createSlice(model, (m) => ({
          count: m.count,
          multiplier: m.multiplier,
          total: m.count * m.multiplier,
        }));

        return { model, actions, views: { state: stateView } };
      });

      const store = createZustandAdapter(counter);

      // Access state through views
      const state = store.views.state();
      expect(state.count).toBe(0);
      expect(state.multiplier).toBe(2);
      expect(state.total).toBe(0);
    });

    it('should provide direct action access', () => {
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

        const countView = createSlice(model, (m) => ({
          count: m.count,
        }));

        return { model, actions, views: { count: countView } };
      });

      const store = createZustandAdapter(counter);

      // Actions are direct methods
      expect(typeof store.actions.increment).toBe('function');
      expect(typeof store.actions.decrement).toBe('function');

      // Methods work correctly
      store.actions.increment();
      expect(store.views.count().count).toBe(1);

      store.actions.decrement();
      expect(store.views.count().count).toBe(0);
    });

    it('should avoid namespace collision', () => {
      const component = createComponent(() => {
        const model = createModel<{
          store: string; // Model has a 'store' property
          actions: string; // Model has an 'actions' property
          views: string; // Model has a 'views' property
          subscribe: string; // Model has a 'subscribe' property
          update: (data: {
            store?: string;
            actions?: string;
            views?: string;
            subscribe?: string;
          }) => void;
        }>(({ set, get }) => ({
          store: 'model-store',
          actions: 'model-actions',
          views: 'model-views',
          subscribe: 'model-subscribe',
          update: (data) => set({ ...get(), ...data }),
        }));

        const actions = createSlice(model, (m) => ({
          update: m.update,
        }));

        const stateSlice = createSlice(model, (m) => ({
          store: m.store,
          actions: m.actions,
          views: m.views,
          subscribe: m.subscribe,
        }));

        return { model, actions, views: { state: stateSlice } };
      });

      const store = createZustandAdapter(component);

      // Adapter properties are separate from model state
      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.actions.update).toBe('function');
      expect(typeof store.views.state).toBe('function');

      // Model state properties don't collide with adapter API
      const stateView = store.views.state();
      expect(stateView.store).toBe('model-store');
      expect(stateView.actions).toBe('model-actions');
      expect(stateView.views).toBe('model-views');
      expect(stateView.subscribe).toBe('model-subscribe');

      // Updates work
      store.actions.update({ store: 'new-store' });
      const updatedView = store.views.state();
      expect(updatedView.store).toBe('new-store');
    });
  });

  describe('createZustandAdapter - views', () => {
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

      const store = createZustandAdapter(component);

      // Static view is a function that returns attributes
      const display = store.views.display();
      expect(display).toEqual({
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

      const store = createZustandAdapter(component);

      // Computed view is a function that returns attributes
      expect(typeof store.views.counter).toBe('function');

      const counterAttrs = store.views.counter();
      expect(counterAttrs).toEqual({
        'data-count': 5,
        className: 'odd',
      });
    });

    it('should update views reactively', () => {
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

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        return {
          model,
          actions,
          views: { display: countSlice },
        };
      });

      const store = createZustandAdapter(component);

      // Views update reactively via the model store
      // Initial state
      expect(store.views.display()).toEqual({ value: 0, doubled: 0 });

      // Update model
      store.actions.increment();

      // View should update
      expect(store.views.display()).toEqual({ value: 1, doubled: 2 });
    });

    it('should handle view with select() markers', () => {
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

        const buttonSlice = createSlice(model, (m) => ({
          onClick: select(actions, (a) => a.increment),
          count: m.count,
          'aria-label': `Count: ${m.count}`,
        }));

        return {
          model,
          actions,
          views: { button: buttonSlice },
        };
      });

      const store = createZustandAdapter(component);

      const buttonView = store.views.button();

      expect(buttonView.count).toBe(0);
      expect(buttonView['aria-label']).toBe('Count: 0');
      expect(typeof buttonView.onClick).toBe('function');

      // Click should increment
      buttonView.onClick();

      // View should update
      const updatedView = store.views.button();
      expect(updatedView.count).toBe(1);
      expect(updatedView['aria-label']).toBe('Count: 1');
    });
  });

  describe('createZustandAdapter - select() resolution', () => {
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

        const buttonSlice = createSlice(model, (m) => ({
          actions: select(actions),
          count: m.count,
        }));

        return {
          model,
          actions,
          views: { button: buttonSlice },
        };
      });

      const store = createZustandAdapter(component);

      const buttonView = store.views.button();
      expect(buttonView.count).toBe(0);
      // actions should be the resolved actions object
      expect(typeof buttonView.actions).toBe('object');
      expect(typeof buttonView.actions.increment).toBe('function');

      // Calling increment should work
      buttonView.actions.increment();

      // Check updated state through view
      const updatedView = store.views.button();
      expect(updatedView.count).toBe(1);
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

        const profileSlice = createSlice(model, () => ({
          userName: select(userSlice, (u) => u.name),
          postCount: select(postsSlice, (p) => p.length),
          fullUser: select(userSlice),
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { profile: profileSlice },
        };
      });

      const store = createZustandAdapter(component);

      const profileView = store.views.profile();

      expect(profileView.userName).toBe('Alice');
      expect(profileView.postCount).toBe(2);
      expect(profileView.fullUser).toEqual({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
      });
    });
  });

  describe('createZustandAdapter - reactivity', () => {
    it('should work with zustand subscriptions', () => {
      // Create a component with a count view
      const componentWithView = createComponent(() => {
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
          views: {
            count: createSlice(model, (m) => ({ count: m.count })),
          },
        };
      });

      const store = createZustandAdapter(componentWithView);

      // Subscribe to count view changes
      const viewStates: { count: number }[] = [];
      const unsub = store.subscribe(
        (views) => views.count(),
        (state) => viewStates.push(state)
      );

      // Trigger changes
      store.actions.increment();
      store.actions.increment();

      expect(viewStates.length).toBe(2);
      expect(viewStates[0]?.count).toBe(1);
      expect(viewStates[1]?.count).toBe(2);

      unsub();
    });

    it('should handle async actions properly', async () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          loading: boolean;
          incrementAsync: () => Promise<void>;
        }>(({ set, get }) => ({
          count: 0,
          loading: false,
          incrementAsync: async () => {
            set({ loading: true });
            await new Promise((resolve) => setTimeout(resolve, 10));
            set({ count: get().count + 1, loading: false });
          },
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            incrementAsync: m.incrementAsync,
          })),
          views: {},
        };
      });

      // Need to add views to check state
      const componentWithViews = createComponent(() => {
        const base = component();
        return {
          ...base,
          views: {
            state: createSlice(base.model, (m) => ({
              count: m.count,
              loading: m.loading,
            })),
          },
        };
      });

      const storeWithViews = createZustandAdapter(componentWithViews);

      expect(storeWithViews.views.state().count).toBe(0);
      expect(storeWithViews.views.state().loading).toBe(false);

      // Start async operation
      const promise = storeWithViews.actions.incrementAsync();
      expect(storeWithViews.views.state().loading).toBe(true);

      // Wait for completion
      await promise;
      expect(storeWithViews.views.state().count).toBe(1);
      expect(storeWithViews.views.state().loading).toBe(false);
    });
  });
}
