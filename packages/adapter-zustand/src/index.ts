/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management,
 * implementing the Lattice adapter specification. It creates reactive
 * stores and slices using Zustand's powerful state management capabilities.
 *
 * Key features:
 * - Full Zustand integration with subscriptions and middleware support
 * - Full support for compose() and slice composition
 * - Type-safe component execution
 * - Auto-generating selectors pattern for clean API
 * - No namespace collision between model state and adapter properties
 */

import type {
  ComponentFactory,
  SliceFactory,
  AdapterResult,
  ViewTypes,
} from '@lattice/core';
import { isSliceFactory, memoizeParameterizedView } from '@lattice/core';
import {
  createStore as zustandCreateStore,
  StoreApi,
  StateCreator,
} from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { createRuntime } from '@lattice/runtime';

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
export interface ZustandAdapterResult<Model, Actions, Views>
  extends AdapterResult<Model, Actions, Views> {
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

// ============================================================================
// Supporting Types and Functions
// ============================================================================

/**
 * Recursively resolves getter functions (zero-argument functions) in an object
 */
function resolveGetters<T>(obj: T): T {
  // If it's a zero-argument function, call it and resolve the result
  if (typeof obj === 'function' && obj.length === 0) {
    const result = obj();
    // Recursively resolve the result in case it contains more getters
    return resolveGetters(result) as T;
  }
  
  // If it's not an object, return as-is
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  // If it's an array, resolve each element
  if (Array.isArray(obj)) {
    return obj.map(item => resolveGetters(item)) as T;
  }
  
  // For objects, recursively resolve each property
  const resolved: any = {};
  for (const [key, value] of Object.entries(obj)) {
    resolved[key] = resolveGetters(value);
  }
  
  return resolved as T;
}

/**
 * Processes views into functions that return view attributes
 */
function processViews<Model, Views>(
  spec: { views: Views },
  executeSliceFactory: <T>(factory: SliceFactory<Model, T>) => T
): ViewTypes<Model, Views> {
  const views = {} as ViewTypes<Model, Views>;

  for (const [key, view] of Object.entries(
    spec.views as Record<string, unknown>
  )) {
    if (isSliceFactory(view)) {
      // Static view: slice factory
      views[key as keyof ViewTypes<Model, Views>] = (() => {
        const result = executeSliceFactory(view);
        return resolveGetters(result);
      }) as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
    } else if (typeof view === 'function') {
      // Computed view - may accept parameters
      const viewFunction = (...args: unknown[]) => {
        // Call the view function with any provided args
        const result = view(...args);

        // If the result is a slice factory, execute it
        if (isSliceFactory(result)) {
          const sliceResult = executeSliceFactory(result);
          return resolveGetters(sliceResult);
        }

        // Otherwise resolve any getters in the result
        return resolveGetters(result);
      };

      // Apply memoization unless disabled for benchmarks
      views[key as keyof ViewTypes<Model, Views>] = (
        process.env.LATTICE_DISABLE_MEMOIZATION === 'true'
          ? viewFunction
          : memoizeParameterizedView(viewFunction)
      ) as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
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
 * @param componentOrFactory - The Lattice component spec or factory
 * @param middleware - Optional function to apply Zustand middleware
 * @returns An adapter result with actions, views, and subscribe
 *
 * @remarks
 * - Model state is kept private - only accessible through views
 * - Actions are regular functions, not hooks
 * - Views are functions that return current attributes
 * - Subscriptions work at the view level, not model level
 */
export function createZustandAdapter<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>,
  middleware?: (
    createStore: typeof zustandCreateStore,
    stateCreator: StateCreator<Model, [], [], Model>
  ) => StoreApi<Model>
): ZustandAdapterResult<Model, Actions, Views> {
  return createRuntime(() => {
    // Get the component spec
    const spec = componentFactory();

    // Create the base state creator
    const baseStateCreator: StateCreator<Model, [], [], Model> = (set, get) => {
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
    };

    // Apply subscribeWithSelector middleware
    const stateCreator = subscribeWithSelector(baseStateCreator);

    // Create the store with optional middleware
    const store: StoreWithSelector<Model> = middleware
      ? middleware(zustandCreateStore, baseStateCreator)
      : zustandCreateStore<Model>()(stateCreator);

    // Create slice executor helper
    const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
      try {
        return factory(() => store.getState());
      } catch (error) {
        throw new ZustandAdapterError('Slice factory execution failed', {
          operation: 'executeSliceFactory',
          details: { sliceFactory: factory.name || 'anonymous' },
          cause: error,
        });
      }
    };

    // Process actions slice
    let actions: Actions;
    try {
      actions = executeSliceFactory<Actions>(spec.actions);
    } catch (error) {
      throw new ZustandAdapterError('Actions slice creation failed', {
        operation: 'createZustandAdapter.actions',
        cause: error,
      });
    }

    // Process views
    let views: ViewTypes<Model, Views>;
    try {
      views = processViews<Model, Views>(spec, executeSliceFactory);
    } catch (error) {
      throw new ZustandAdapterError('Views processing failed', {
        operation: 'createZustandAdapter.views',
        cause: error,
      });
    }

    // Create the unified API
    return {
      // Clean actions API - just the actions object
      actions,

      // Views API - functions that return view attributes
      views,

      getState: () => store.getState(),

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

      destroy: () => {
        // Clear all subscriptions by replacing with empty state
        // This will trigger all listeners one last time, then they should unsubscribe
        store.setState({} as Model);

        // Zustand stores don't have a built-in destroy method, but clearing state
        // and letting subscriptions naturally unsubscribe when components unmount
        // is the recommended approach. The store object itself will be garbage
        // collected when all references are released.
      },
    };
  });
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createModel, createSlice, compose } = await import('@lattice/core');

  describe('createZustandAdapter - unified API', () => {
    it('should return actions, views, and subscribe', () => {
      const counter = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
        }));

        return { model, actions, views: {} };
      };

      const store = createZustandAdapter(counter);

      expect(store).toBeDefined();
      expect(typeof store.subscribe).toBe('function');
      expect(store.actions).toBeDefined();
      expect(store.views).toBeDefined();

      // Should not expose internal store methods
      // @ts-expect-error
      expect(store.setState).toBeUndefined();
      // @ts-expect-error
      expect(store.use).toBeUndefined();
    });

    it('should access state through views', () => {
      const counter = () => {
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
          increment: m().increment,
        }));

        const stateView = createSlice(model, (m) => {
          return {
            count: m.count,
            multiplier: m.multiplier,
            total: m.count * m.multiplier,
          };
        });

        return { model, actions, views: { state: stateView } };
      };

      const store = createZustandAdapter(counter);

      // Access state through views
      const state = store.views.state();
      expect(state.count).toBe(0);
      expect(state.multiplier).toBe(2);
      expect(state.total).toBe(0);
    });

    it('should provide direct action access', () => {
      const counter = () => {
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
      };

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
      const component = () => {
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

        const stateSlice = createSlice(model, (m) => {
          return {
            store: m.store,
            actions: m.actions,
            views: m.views,
            subscribe: m.subscribe,
          };
        });

        return { model, actions, views: { state: stateSlice } };
      };

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
      const component = () => {
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
          actions: createSlice(model, (_getModel) => ({})),
          views: { display: displaySlice },
        };
      };

      const store = createZustandAdapter(component);

      // Static view is a function that returns attributes
      const display = store.views.display();
      expect(display).toEqual({
        value: 5,
        isDisabled: false,
      });
    });

    it('should handle computed view functions', () => {
      const component = () => {
        const model = createModel<{ count: number }>(() => ({ count: 5 }));

        const countSlice = createSlice(model, (m) => ({
          count: m.count,
        }));

        const counterView = createSlice(model, (m) => {
          const state = countSlice(() => m);
          return {
            'data-count': state.count,
            className: state.count % 2 === 0 ? 'even' : 'odd',
          };
        });

        const views = { counter: counterView };

        return {
          model,
          actions: createSlice(model, (_getModel) => ({})),
          views,
        };
      };

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
      const component = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const countSlice = createSlice(model, (m) => {
          return {
            value: m.count,
            doubled: m.count * 2,
          };
        });

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
        }));

        return {
          model,
          actions,
          views: { display: countSlice },
        };
      };

      const store = createZustandAdapter(component);

      // Views update reactively via the model store
      // Initial state
      expect(store.views.display()).toEqual({ value: 0, doubled: 0 });

      // Update model
      store.actions.increment();

      // View should update
      expect(store.views.display()).toEqual({ value: 1, doubled: 2 });
    });

    it('should handle view with compose()', () => {
      const component = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
        }));

        const buttonSlice = createSlice(
          model,
          compose({ actions }, (m, { actions }) => ({
            onClick: actions.increment,
            count: m.count,
            'aria-label': `Count: ${m.count}`,
          }))
        );

        return {
          model,
          actions,
          views: { button: buttonSlice },
        };
      };

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

  describe('createZustandAdapter - compose() resolution', () => {
    it('should handle compose() in slices', () => {
      const component = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
        }));

        const buttonSlice = createSlice(
          model,
          compose({ actions }, (m, { actions }) => ({
            actions: actions,
            count: m.count,
          }))
        );

        return {
          model,
          actions,
          views: { button: buttonSlice },
        };
      };

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

    it('should handle compose() with multiple dependencies', () => {
      const component = () => {
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

        const profileSlice = createSlice(
          model,
          compose(
            { userSlice, postsSlice },
            (_, { userSlice, postsSlice }) => ({
              userName: userSlice.name,
              postCount: postsSlice.length,
              fullUser: userSlice,
            })
          )
        );

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { profile: profileSlice },
        };
      };

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
      const componentWithView = () => {
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
      };

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
      const component = () => {
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
      };

      // Need to add views to check state
      const componentWithViews = () => {
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
      };

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

    it('should accept and apply Zustand middleware', () => {
      const component = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      };

      // Track middleware application
      let middlewareApplied = false;
      let capturedStateCreator: unknown;

      // Custom middleware that adds logging
      const customMiddleware = <T>(
        createStore: typeof zustandCreateStore,
        stateCreator: StateCreator<T, [], [], T>
      ) => {
        middlewareApplied = true;
        capturedStateCreator = stateCreator;

        // Apply a simple logging middleware by wrapping the set function
        const loggedStateCreator: StateCreator<T, [], [], T> = (
          set,
          get,
          api
        ) => {
          const state = stateCreator(set, get, api);
          return state;
        };

        return createStore<T>()(loggedStateCreator);
      };

      const store = createZustandAdapter(component, customMiddleware);

      // Verify middleware was applied
      expect(middlewareApplied).toBe(true);
      expect(capturedStateCreator).toBeDefined();

      // Verify the store still works correctly
      expect(store.views.count().value).toBe(0);
      store.actions.increment();
      expect(store.views.count().value).toBe(1);
    });

    it('should handle views that use API through composition', () => {
      const component = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
        }));

        // Slice that uses API to compose data
        const statusSlice = createSlice(model, (m) => {
          // Can use API within slices
          const countSlice = createSlice(model, (gm) => ({ count: gm.count }));
          const state = countSlice(() => m);

          return {
            count: state.count,
            doubled: state.count * 2,
          };
        });

        return {
          model,
          actions,
          views: {
            status: statusSlice,
          },
        };
      };

      const store = createZustandAdapter(component);

      // Call the view
      const result = store.views.status();
      expect(result.count).toBe(0);
      expect(result.doubled).toBe(0);

      // Update state and verify
      store.actions.increment();
      const updatedResult = store.views.status();
      expect(updatedResult.count).toBe(1);
      expect(updatedResult.doubled).toBe(2);
    });
  });
}
