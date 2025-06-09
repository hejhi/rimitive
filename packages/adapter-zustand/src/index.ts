/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management,
 * implementing the Lattice adapter specification. It creates reactive
 * stores and slices using Zustand's powerful state management capabilities.
 *
 * Key features:
 * - Minimal bridge between Lattice specs and Zustand
 * - Direct execution of component specifications
 * - Clean separation between model state and adapter API
 */

import type {
  ComponentFactory,
  SliceFactory,
  AdapterResult,
  ViewTypes,
} from '@lattice/core';
import { isSliceFactory } from '@lattice/core';
import {
  createStore as zustandCreateStore,
  StoreApi,
  StateCreator,
} from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { createRuntime } from '@lattice/runtime';

// ============================================================================
// Core Types
// ============================================================================

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

/**
 * Creates a Zustand adapter for a Lattice component.
 *
 * The adapter's role is minimal - it executes the component specification
 * with Zustand as the state management infrastructure.
 *
 * @param componentFactory - The Lattice component spec factory
 * @param middleware - Optional Zustand middleware
 * @returns An adapter result with actions, views, and subscribe
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
      return spec.model({ set, get });
    };

    // Apply subscribeWithSelector middleware
    const stateCreator = subscribeWithSelector(baseStateCreator);

    // Create the store with optional middleware
    const store: StoreWithSelector<Model> = middleware
      ? middleware(zustandCreateStore, baseStateCreator)
      : zustandCreateStore<Model>()(stateCreator);

    // Helper to execute slice factories
    const executeSlice = <T>(factory: SliceFactory<Model, T>): T => {
      return factory(() => store.getState());
    };

    // Process actions - just execute the slice
    const actions = executeSlice(spec.actions);

    // Process views - each view is a function that returns current data
    const views = {} as ViewTypes<Model, Views>;

    for (const [key, view] of Object.entries(
      spec.views as Record<string, unknown>
    )) {
      if (isSliceFactory(view)) {
        // It's a slice factory - execute it to get the result
        const sliceResult = executeSlice(view);

        // The result might be:
        // 1. An object with getters (regular slice)
        // 2. A function (parameterized view from resolve())

        if (typeof sliceResult === 'function') {
          // It's already a view function (e.g., from resolve())
          views[key as keyof ViewTypes<Model, Views>] =
            sliceResult as ViewTypes<Model, Views>[keyof ViewTypes<
              Model,
              Views
            >];
        } else {
          // It's a regular slice result - wrap it in a function
          views[key as keyof ViewTypes<Model, Views>] = (() =>
            sliceResult) as ViewTypes<Model, Views>[keyof ViewTypes<
            Model,
            Views
          >];
        }
      } else if (typeof view === 'function') {
        // It's already a function (computed view) - use it directly
        views[key as keyof ViewTypes<Model, Views>] = view as ViewTypes<
          Model,
          Views
        >[keyof ViewTypes<Model, Views>];
      }
    }

    // Return the adapter result
    return {
      actions,
      views,
      getState: () => store.getState(),
      subscribe: <Selected>(
        selector: (views: ViewTypes<Model, Views>) => Selected,
        callback: SubscribeCallback<Selected>
      ) => {
        // Subscribe using the view selector
        const viewSelector = (_state: Model) => selector(views);
        return store.subscribe(viewSelector, callback);
      },
      destroy: () => {
        // Clear state to trigger final updates
        store.setState({} as Model);
      },
    };
  });
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createModel, createSlice } = await import('@lattice/core');

  describe('createZustandAdapter - minimal implementation', () => {
    it('should execute specs and provide adapter API', () => {
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

        const views = {
          counter: createSlice(model, (m) => ({
            value: () => m().count,
          })),
        };

        return { model, actions, views };
      };

      const store = createZustandAdapter(counter);

      // Test basic functionality
      expect(typeof store.actions.increment).toBe('function');
      expect(typeof store.views.counter).toBe('function');

      const view = store.views.counter();
      expect(typeof view.value).toBe('function');
      expect(view.value()).toBe(0);

      store.actions.increment();

      const updatedView = store.views.counter();
      expect(updatedView.value()).toBe(1);
    });
  });
}
