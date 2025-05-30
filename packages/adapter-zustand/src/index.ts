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

import type { ComponentFactory, SliceFactory, SelectMarkerValue } from '@lattice/core';
import { SELECT_MARKER, SLICE_FACTORY_MARKER } from '@lattice/core';
import type { StoreApi } from 'zustand';
import { createStore } from 'zustand/vanilla';

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
export interface Store<T> {
  get: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  subscribe: (listener: (value: T) => void) => () => void;
  destroy?: () => void;
}

/**
 * Selector hook that can be used directly in React components
 */
type SelectorHook<T> = () => T;

/**
 * Maps model properties to selector hooks for the use property
 */
type UseSelectors<Model> = {
  [K in keyof Model]: SelectorHook<Model[K]>;
};

/**
 * Maps action methods to selector hooks
 */
type ActionHooks<Actions> = {
  [K in keyof Actions]: SelectorHook<Actions[K]>;
};

/**
 * Maps view types from slice factories to selector hooks that return view attributes
 */
type ViewHook<Model, T> = T extends () => SliceFactory<Model, infer S>
  ? () => S
  : T extends SliceFactory<Model, infer S>
    ? () => S
    : never;

/**
 * Maps all views in a component to their hook types
 */
type ViewHooks<Model, Views> = {
  [K in keyof Views]: ViewHook<Model, Views[K]>;
};

/**
 * Result of executing a component with the zustand adapter
 */
export interface ZustandAdapterResult<Model, Actions, Views> extends StoreApi<Model> {
  /**
   * Auto-generated selectors for each model property
   * @example
   * const count = counterStore.use.count();
   * const user = userStore.use.user();
   */
  use: UseSelectors<Model>;
  
  /**
   * Action selector hooks - each returns the corresponding method
   * @example
   * const increment = counterStore.actions.increment();
   * // Later: increment();
   */
  actions: ActionHooks<Actions>;
  
  /**
   * View hooks - each returns the view attributes directly
   * @example
   * const attrs = counterStore.views.display(); // Returns view attributes
   * const buttonAttrs = counterStore.views.button(); // Returns UI attributes
   */
  views: ViewHooks<Model, Views>;
}

// ============================================================================
// Type Helpers
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
 * Checks if a function is a SliceFactory (has the brand)
 */
function isSliceFactory(fn: unknown): fn is SliceFactory {
  return typeof fn === 'function' && SLICE_FACTORY_MARKER in fn;
}

// ============================================================================
// Primitive Implementations
// ============================================================================

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
        slice = createZustandSlice(modelStore, (state) => {
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
        const selected = markerValue.selector(sliceResult);
        return selected as T;
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

/**
 * Creates a slice that automatically resolves select() markers
 */
function createSliceWithSelectSupport<Model, T>(
  modelStore: Store<Model>,
  sliceFactory: SliceFactory<Model, T>,
  sliceCache: SliceCache<Model>
): Store<T> {
  try {
    const slice = createZustandSlice(modelStore, (state) => {
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
 * Processes views into reactive hooks that return view attributes
 */
function processViews<Model, Views>(
  spec: { views: Views },
  modelStore: Store<Model>,
  sliceCache: SliceCache<Model>
): ViewHooks<Model, Views> {
  const views = {} as ViewHooks<Model, Views>;

  for (const key in spec.views) {
    const view = spec.views[key];
    if (!view || typeof view !== 'function') continue;

    if (isSliceFactory(view)) {
      // Static slice view - create a hook that returns view attributes
      const viewSlice = createSliceWithSelectSupport(modelStore, view, sliceCache);
      
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
            const viewSlice = createSliceWithSelectSupport(modelStore, sliceFactory, sliceCache);
            return viewSlice.get();
          } catch (error) {
            throw new ZustandAdapterError(
              `Failed to compute view "${String(key)}"`,
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
 * Creates a Zustand adapter for a Lattice component, following Zustand's
 * auto-generating selectors pattern for a clean, namespace-collision-free API.
 *
 * The adapter returns a store object enhanced with:
 * - `use`: Auto-generated selectors for each model property
 * - `actions`: Selector hooks for each action method
 * - `views`: Hooks that return reactive stores for each view
 *
 * @param componentFactory - The Lattice component factory
 * @returns A Zustand store enhanced with use, actions, and views
 *
 * @example
 * ```typescript
 * // Create the adapter
 * const counterStore = createZustandAdapter(counter);
 * 
 * // === React Usage ===
 * function Component() {
 *   const count = counterStore.use.count();
 *   const increment = counterStore.actions.increment();
 *   const display = counterStore.views.display();
 *   return <div onClick={increment}>{display.text}</div>;
 * }
 * 
 * // === Vanilla JavaScript Usage ===
 * // Direct state access (no reactivity needed)
 * const state = counterStore.getState();
 * console.log(state.count); // Access state
 * state.increment(); // Call actions directly
 * 
 * // With subscriptions for reactivity
 * const unsubscribe = counterStore.subscribe((state) => {
 *   console.log('Count changed:', state.count);
 * });
 * 
 * // Access views (hooks returning attributes)
 * const displayAttrs = counterStore.views.display();
 * console.log(displayAttrs); // Get current view attributes
 * 
 * // Views are reactive via the main store subscription
 * // No separate view subscriptions needed
 * 
 * // Clean up main subscription when done
 * unsubscribe();
 * ```
 * 
 * @remarks
 * Key differences between React and vanilla usage:
 * - React: Hooks handle subscriptions automatically via React's rendering cycle
 * - Vanilla: You manage subscriptions manually for reactive updates
 * - Both: Direct state access via getState() works without subscriptions
 * - Views: Call as functions to get current attributes in vanilla JS
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
    throw new ZustandAdapterError(
      'Component factory execution failed',
      {
        operation: 'createZustandAdapter.componentFactory',
        cause: error
      }
    );
  }

  // Create the Zustand store with only model state
  const store = createStore<Model>((set, get) => {
    // Execute the model factory with Zustand's set/get
    let model: Model;
    try {
      model = spec.model({ set, get });
    } catch (error) {
      throw new ZustandAdapterError(
        'Model factory execution failed',
        {
          operation: 'createZustandAdapter.modelFactory',
          cause: error
        }
      );
    }
    
    return model;
  });

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
    actionsSlice = createSliceWithSelectSupport(modelStore, spec.actions, sliceCache);
  } catch (error) {
    throw new ZustandAdapterError(
      'Actions slice creation failed',
      {
        operation: 'createZustandAdapter.actions',
        cause: error
      }
    );
  }

  // Create action selector hooks
  const actions = {} as ActionHooks<Actions>;
  const actionsValue = actionsSlice.get();
  
  for (const key in actionsValue) {
    if (Object.prototype.hasOwnProperty.call(actionsValue, key)) {
      // Each action hook returns the current method from the actions slice
      Object.defineProperty(actions, key, {
        value: () => actionsSlice.get()[key as keyof Actions],
        enumerable: true,
        configurable: true,
      });
    }
  }

  // Process views
  let views: ViewHooks<Model, Views>;
  try {
    views = processViews<Model, Views>(spec, modelStore, sliceCache);
  } catch (error) {
    throw new ZustandAdapterError(
      'Views processing failed',
      {
        operation: 'createZustandAdapter.views',
        cause: error
      }
    );
  }

  // Create auto-generated selectors for the `use` property
  const use = {} as UseSelectors<Model>;
  const modelState = store.getState();
  
  for (const key in modelState) {
    if (Object.prototype.hasOwnProperty.call(modelState, key)) {
      // Each selector returns the current value from the store
      Object.defineProperty(use, key, {
        value: () => store.getState()[key],
        enumerable: true,
        configurable: true,
      });
    }
  }

  // Return enhanced store object
  return Object.assign(store, {
    use,
    actions,
    views,
  });
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createComponent, createModel, createSlice, select } = await import(
    '@lattice/core'
  );

  describe('createZustandAdapter - refactored API', () => {
    it('should return store, actions, and views separately', () => {
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

      const counterStore = createZustandAdapter(counter);
      
      expect(counterStore).toBeDefined();
      expect(typeof counterStore.getState).toBe('function');
      expect(typeof counterStore.subscribe).toBe('function');
      expect(counterStore.use).toBeDefined();
      expect(counterStore.actions).toBeDefined();
      expect(counterStore.views).toBeDefined();
    });

    it('should access state through use selectors and getState', () => {
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

        return { model, actions, views: {} };
      });

      const counterStore = createZustandAdapter(counter);
      
      // Use auto-generated selectors
      expect(counterStore.use.count()).toBe(0);
      expect(counterStore.use.multiplier()).toBe(2);
      
      // Direct access via getState
      expect(counterStore.getState().count).toBe(0);
      expect(counterStore.getState().multiplier).toBe(2);
      
      // Manual computed selectors work
      const state = counterStore.getState();
      expect(state.count * state.multiplier).toBe(0);
    });

    it('should provide action selector hooks', () => {
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

        return { model, actions, views: {} };
      });

      const counterStore = createZustandAdapter(counter);
      
      // Action hooks return the methods
      const increment = counterStore.actions.increment();
      const decrement = counterStore.actions.decrement();
      
      expect(typeof increment).toBe('function');
      expect(typeof decrement).toBe('function');
      
      // Methods work correctly
      increment();
      expect(counterStore.use.count()).toBe(1);
      expect(counterStore.getState().count).toBe(1);
      
      decrement();
      expect(counterStore.use.count()).toBe(0);
      expect(counterStore.getState().count).toBe(0);
    });

    it('should avoid namespace collision', () => {
      const component = createComponent(() => {
        const model = createModel<{
          store: string;  // Model has a 'store' property
          actions: string;  // Model has an 'actions' property
          views: string;  // Model has a 'views' property
          update: (data: { store?: string; actions?: string; views?: string }) => void;
        }>(({ set, get }) => ({
          store: 'model-store',
          actions: 'model-actions',
          views: 'model-views',
          update: (data) => set({ ...get(), ...data }),
        }));

        const actions = createSlice(model, (m) => ({
          update: m.update,
        }));

        const stateSlice = createSlice(model, (m) => ({
          store: m.store,
          actions: m.actions,
          views: m.views,
        }));

        return { model, actions, views: { state: stateSlice } };
      });

      const componentStore = createZustandAdapter(component);
      
      // Adapter properties are separate from model state
      expect(typeof componentStore.getState).toBe('function');
      expect(typeof componentStore.use.store).toBe('function');
      expect(typeof componentStore.use.actions).toBe('function');
      expect(typeof componentStore.use.views).toBe('function');
      expect(typeof componentStore.actions.update).toBe('function');
      expect(typeof componentStore.views.state).toBe('function');
      
      // Model state is accessible through use selectors
      expect(componentStore.use.store()).toBe('model-store');
      expect(componentStore.use.actions()).toBe('model-actions');
      expect(componentStore.use.views()).toBe('model-views');
      
      // Model state is also accessible through getState
      expect(componentStore.getState().store).toBe('model-store');
      expect(componentStore.getState().actions).toBe('model-actions');
      expect(componentStore.getState().views).toBe('model-views');
      
      // Views work correctly
      const stateView = componentStore.views.state();
      expect(stateView.store).toBe('model-store');
      expect(stateView.actions).toBe('model-actions');
      expect(stateView.views).toBe('model-views');
      
      // Updates work
      const update = componentStore.actions.update();
      update({ store: 'new-store' });
      expect(componentStore.use.store()).toBe('new-store');
      expect(componentStore.getState().store).toBe('new-store');
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

      const componentStore = createZustandAdapter(component);

      // Static view is a hook that returns attributes
      const display = componentStore.views.display();
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

      const componentStore = createZustandAdapter(component);

      // Computed view is a hook that returns attributes
      expect(typeof componentStore.views.counter).toBe('function');

      const counterAttrs = componentStore.views.counter();
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

      const componentStore = createZustandAdapter(component);
      
      // Views update reactively via the model store
      // Initial state
      expect(componentStore.views.display()).toEqual({ value: 0, doubled: 0 });

      // Update model
      const increment = componentStore.actions.increment();
      increment();

      // View should update
      expect(componentStore.views.display()).toEqual({ value: 1, doubled: 2 });
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

      const componentStore = createZustandAdapter(component);

      const buttonView = componentStore.views.button();
      
      expect(buttonView.count).toBe(0);
      expect(buttonView['aria-label']).toBe('Count: 0');
      expect(typeof buttonView.onClick).toBe('function');

      // Click should increment
      buttonView.onClick();
      expect(componentStore.use.count()).toBe(1);
      expect(componentStore.getState().count).toBe(1);
      
      // View should update
      const updatedView = componentStore.views.button();
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

      const componentStore = createZustandAdapter(component);

      const buttonView = componentStore.views.button();
      expect(buttonView.count).toBe(0);
      // actions should be the resolved actions object
      expect(typeof buttonView.actions).toBe('object');
      expect(typeof buttonView.actions.increment).toBe('function');

      // Calling increment should work
      buttonView.actions.increment();
      expect(componentStore.use.count()).toBe(1);
      expect(componentStore.getState().count).toBe(1);
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

      const componentStore = createZustandAdapter(component);

      const profileView = componentStore.views.profile();
      
      expect(profileView.userName).toBe('Alice');
      expect(profileView.postCount).toBe(2);
      expect(profileView.fullUser).toEqual({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com'
      });
    });
  });

  describe('createZustandAdapter - reactivity', () => {
    it('should work with zustand subscriptions', () => {
      const component = createComponent(() => {
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

      const componentStore = createZustandAdapter(component);
      
      // Subscribe to state changes
      const states: any[] = [];
      const unsubscribe = componentStore.subscribe((state) => {
        states.push({ count: state.count });
      });

      // Trigger changes
      const increment = componentStore.actions.increment();
      increment();
      increment();

      expect(states.length).toBe(2);
      expect(states[0].count).toBe(1);
      expect(states[1].count).toBe(2);
      
      unsubscribe();
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
            await new Promise(resolve => setTimeout(resolve, 10));
            set({ count: get().count + 1, loading: false });
          },
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({ incrementAsync: m.incrementAsync })),
          views: {},
        };
      });

      const componentStore = createZustandAdapter(component);
      
      expect(componentStore.use.count()).toBe(0);
      expect(componentStore.use.loading()).toBe(false);
      
      // Start async operation
      const incrementAsync = componentStore.actions.incrementAsync();
      const promise = incrementAsync();
      expect(componentStore.use.loading()).toBe(true);
      
      // Wait for completion
      await promise;
      expect(componentStore.use.count()).toBe(1);
      expect(componentStore.use.loading()).toBe(false);
    });
  });
}