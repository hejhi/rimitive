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
import type { StateCreator } from 'zustand';

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
 * Creates a Zustand state creator function from a Lattice component.
 *
 * This function returns a StateCreator that can be used directly with Zustand's
 * create() function or composed with middleware. The resulting store will have
 * the component's model state and methods at the root level, with additional
 * properties for actions and views.
 *
 * @param componentFactory - The Lattice component factory
 * @returns A Zustand StateCreator function
 *
 * @example
 * ```typescript
 * import { create } from 'zustand';
 * import { devtools } from 'zustand/middleware';
 * 
 * // Direct usage
 * const useStore = create(createZustandAdapter(myComponent));
 * 
 * // With middleware
 * const useStore = create(devtools(createZustandAdapter(myComponent)));
 * 
 * // Access state and methods
 * const count = useStore(state => state.count);
 * const increment = useStore(state => state.increment);
 * 
 * // Access actions and views
 * const actions = useStore(state => state.actions);
 * const views = useStore(state => state.views);
 * ```
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
): StateCreator<Model & { actions: Actions; views: ExecutedViews<Model, Views> }> {
  // Return a state creator function that Zustand's create() can use
  return (set, get, api) => {
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

    // First, create a temporary model with just the initial state to bootstrap
    let tempModel: Model;
    try {
      tempModel = spec.model({
        get: () => ({} as Model), // Temporary empty model
        set: () => {}, // No-op during initialization
      });
    } catch (error) {
      throw new ZustandAdapterError(
        'Model factory execution failed',
        {
          operation: 'createZustandAdapter.modelFactory',
          cause: error
        }
      );
    }

    // Helper to extract model properties from the full state
    const getModelFromState = (state: any): Model => {
      if (!state) return tempModel; // Return the initial model if state is undefined
      const modelState = {} as Model;
      for (const key in tempModel) {
        if (Object.prototype.hasOwnProperty.call(tempModel, key) && 
            key !== 'actions' && key !== 'views' && key in state) {
          (modelState as any)[key] = state[key];
        }
      }
      // If modelState is empty, return tempModel
      const hasKeys = Object.keys(modelState as any).length > 0;
      return hasKeys ? modelState : tempModel;
    };

    // Now create the actual model with proper get/set
    let model: Model;
    try {
      model = spec.model({
        get: () => getModelFromState(get()),
        set: (updates) => set((state) => ({ ...state, ...updates })),
      });
    } catch (error) {
      throw new ZustandAdapterError(
        'Model factory execution failed during second pass',
        {
          operation: 'createZustandAdapter.modelFactory.secondPass',
          cause: error
        }
      );
    }

    // Create a lightweight store interface for our internal use
    const modelStore: Store<Model> = {
      get: () => getModelFromState(get()),
      set: (value) => {
        if (typeof value === 'function') {
          set((state) => {
            const modelState = getModelFromState(state);
            const updates = (value as (prev: Model) => Model)(modelState);
            return { ...state, ...updates };
          });
        } else {
          set((state) => ({ ...state, ...value }));
        }
      },
      subscribe: (listener) => {
        // Subscribe to state changes but only call listener when model parts change
        return api.subscribe((state, prevState) => {
          // Extract only model properties for comparison
          const modelKeys = Object.keys(model as any) as (keyof Model)[];
          const hasModelChange = modelKeys.some(key => 
            key !== 'actions' && key !== 'views' && 
            state[key as keyof typeof state] !== prevState[key as keyof typeof prevState]
          );
          if (hasModelChange) {
            listener(getModelFromState(state));
          }
        });
      },
    };

    // Set up slice tracking for select() resolution
    const sliceCache = new SliceCache<Model>();

    // Process actions slice
    let actions: Actions;
    try {
      const actionsSlice = createSliceWithSelectSupport(modelStore, spec.actions, sliceCache);
      actions = actionsSlice.get();
    } catch (error) {
      throw new ZustandAdapterError(
        'Actions slice creation failed',
        {
          operation: 'createZustandAdapter.actions',
          cause: error
        }
      );
    }

    // Process views
    let views: ExecutedViews<Model, Views>;
    try {
      views = processViews<Model, Views>(spec, (factory) =>
        createSliceWithSelectSupport(modelStore, factory, sliceCache)
      );
    } catch (error) {
      throw new ZustandAdapterError(
        'Views processing failed',
        {
          operation: 'createZustandAdapter.views',
          cause: error
        }
      );
    }

    // Return the complete state object
    return {
      ...model,
      actions,
      views,
    };
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

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;
  const { createComponent, createModel, createSlice, select } = await import(
    '@lattice/core'
  );
  const { create } = await import('zustand');
  const { devtools: _devtools } = await import('zustand/middleware');

  describe('createZustandAdapter - basic usage', () => {
    it('should return a state creator function', () => {
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

      const stateCreator = createZustandAdapter(counter);
      expect(typeof stateCreator).toBe('function');
    });

    it('should work with zustand create()', () => {
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

      const useStore = create(createZustandAdapter(counter));
      
      // Access state directly
      expect(useStore.getState().count).toBe(0);
      
      // Call methods directly
      useStore.getState().increment();
      expect(useStore.getState().count).toBe(1);
      
      // Access actions - they should be the same function
      expect(typeof useStore.getState().actions.increment).toBe('function');
      expect(typeof useStore.getState().increment).toBe('function');
    });

    it('should work with middleware', () => {
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

      // Mock devtools to verify it's called
      const mockDevtools = vi.fn((config: any) => config);
      const useStore = create(mockDevtools(createZustandAdapter(counter)) as StateCreator<any>);
      
      expect(mockDevtools).toHaveBeenCalledOnce();
      expect(useStore.getState().count).toBe(0);
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

      const useStore = create(createZustandAdapter(component));
      const state = useStore.getState();

      // Static view should be a reactive store
      const display = state.views.display;
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

      const useStore = create(createZustandAdapter(component));
      const state = useStore.getState();

      // Computed view should be a function that returns a store
      expect(typeof state.views.counter).toBe('function');

      // Type should be inferred correctly
      const counter = state.views.counter;
      const counterStore = counter();
      expect(counterStore.get()).toEqual({
        'data-count': 5,
        className: 'odd',
      });
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
          onClick: select(actions),
          count: m.count,
        }));

        return {
          model,
          actions,
          views: { button: buttonSlice },
        };
      });

      const useStore = create(createZustandAdapter(component));
      const state = useStore.getState();

      const button = state.views.button;
      const buttonView = button.get();
      expect(buttonView.count).toBe(0);
      // onClick should be the resolved actions object
      expect(typeof buttonView.onClick).toBe('object');
      expect(typeof buttonView.onClick.increment).toBe('function');

      // Clicking should increment
      buttonView.onClick.increment();
      expect(useStore.getState().count).toBe(1);
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

      const useStore = create(createZustandAdapter(component));
      const state = useStore.getState();

      const profile = state.views.profile;
      const profileView = profile.get();
      
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
    it('should update views reactively when model changes', () => {
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

      const useStore = create(createZustandAdapter(component));
      
      // Subscribe to view changes
      const viewChanges: { value: number; doubled: number }[] = [];
      const unsubscribe = useStore.getState().views.display.subscribe((value) => viewChanges.push(value));

      // Initial state
      expect(useStore.getState().views.display.get()).toEqual({ value: 0, doubled: 0 });

      // Update model
      useStore.getState().increment();

      // View should update
      expect(useStore.getState().views.display.get()).toEqual({ value: 1, doubled: 2 });
      expect(viewChanges).toHaveLength(1);
      expect(viewChanges[0]).toEqual({ value: 1, doubled: 2 });

      unsubscribe();
    });

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

      const useStore = create(createZustandAdapter(component));
      
      // Subscribe to state changes
      const states: any[] = [];
      const unsubscribe = useStore.subscribe((state) => {
        states.push({ count: state.count });
      });

      // Trigger changes
      useStore.getState().increment();
      useStore.getState().increment();

      expect(states.length).toBe(2);
      expect(states[0].count).toBe(1);
      expect(states[1].count).toBe(2);
      
      unsubscribe();
    });
  });
}
