import type {
  SliceFactory,
  ModelFactory,
  ComponentFactory,
  ComponentSpec,
  AdapterAPI,
} from '@lattice/core';
import { isSliceFactory } from '@lattice/core';

// Define types locally
type StateSubscriber<T> = (state: T) => void;

/**
 * Test store implementation that properly executes slice factories.
 * Can optionally implement AdapterAPI for slices that need it.
 */
export class TestStore<TState> implements AdapterAPI<TState> {
  private state: TState;
  private subscribers = new Set<StateSubscriber<TState>>();
  private sliceCache = new Map<SliceFactory<TState, unknown>, unknown>();

  constructor(initialState: TState) {
    this.state = initialState;
  }

  getState(): TState {
    return this.state;
  }

  setState(partial: Partial<TState>): void {
    this.state = { ...this.state, ...partial };
    // Clear cache when state changes
    this.clearCache();
    this.notifySubscribers();
  }

  subscribe(listener: StateSubscriber<TState>): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((listener) => listener(this.state));
  }

  /**
   * Execute a slice factory with API support
   */
  executeSlice<TResult>(sliceFactory: SliceFactory<TState, TResult>): TResult {
    // Check cache first
    if (this.sliceCache.has(sliceFactory)) {
      return this.sliceCache.get(sliceFactory) as TResult;
    }

    try {
      // Execute the slice factory with a getter function
      const result = sliceFactory(() => this.state);

      // Cache the result
      this.sliceCache.set(sliceFactory, result);

      return result;
    } catch (error) {
      // Re-throw with additional context for debugging
      const enhancedError = new Error(
        `Failed to execute slice factory: ${error instanceof Error ? error.message : String(error)}`
      );
      (enhancedError as any).cause = error;
      (enhancedError as any).state = this.state;
      (enhancedError as any).sliceFactory = sliceFactory;
      throw enhancedError;
    }
  }

  /**
   * Clear the slice cache (useful for testing)
   */
  clearCache(): void {
    this.sliceCache.clear();
  }
}

/**
 * Test adapter that creates a test store for a model factory
 */
export function createTestAdapter<TModel>(
  modelFactory: ModelFactory<TModel>
): TestStore<TModel> {
  // Create a temporary store to bootstrap
  let tempState = {} as TModel;

  // First pass: get initial state shape
  const initialModel = modelFactory({
    set: (partial) => {
      tempState = { ...tempState, ...partial };
    },
    get: () => tempState,
  });

  // Create the test store with initial state
  const store = new TestStore<TModel>(initialModel);

  // Second pass: wire up real set/get to store
  const realModel = modelFactory({
    set: (partial) => store.setState(partial),
    get: () => store.getState(),
  });

  // Update the store with the properly wired model
  store.setState(realModel);

  return store;
}

/**
 * Create a test harness for a component factory
 */
export function createComponentTest<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>
): {
  store: TestStore<Model>;
  api: AdapterAPI<Model>;
  component: ComponentSpec<Model, Actions, Views>;
  getState: () => Model;
  getActions: () => Actions;
  getSlice: <T>(sliceFactory: SliceFactory<Model, T>) => T;
  getView: (viewName: keyof Views) => unknown;
} {
  const component = componentFactory();
  const store = createTestAdapter(component.model);

  return {
    store,
    api: store, // The store itself implements AdapterAPI
    component,
    getState: () => store.getState(),
    getActions: () => store.executeSlice(component.actions),
    getSlice: (sliceFactory) => store.executeSlice(sliceFactory),
    getView: (viewName) => {
      const view = component.views[viewName];

      // If it's a slice factory, execute it
      if (isSliceFactory(view)) {
        return store.executeSlice(view);
      }

      // If it's a function, it might be a computed view
      if (typeof view === 'function') {
        const viewResult = view();

        // If the result is a slice factory, execute it
        if (isSliceFactory(viewResult)) {
          return store.executeSlice(viewResult);
        }

        // If it's a function, it might be a selector
        if (typeof viewResult === 'function') {
          return viewResult(store.getState());
        }

        // Otherwise return the result as-is
        return viewResult;
      }

      // If we get here, we don't know what to do with the view
      throw new Error(`Unable to execute view: ${String(viewName)}`);
    },
  };
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createModel, createSlice } = await import('@lattice/core');

  describe('TestStore', () => {
    it('should work with slices created by createSlice', () => {
      const store = new TestStore({ count: 5, name: 'test' });

      // Test a simple slice without API usage
      const simpleSlice = createSlice(
        createModel<{ count: number; name: string }>(() => ({
          count: 0,
          name: '',
        })),
        (state) => ({ doubledCount: state.count * 2 })
      );

      const result1 = store.executeSlice(simpleSlice);
      expect(result1).toEqual({ doubledCount: 10 });

      // Test a slice that uses the API parameter
      const apiSlice = createSlice(
        createModel<{ count: number; name: string }>(() => ({
          count: 0,
          name: '',
        })),
        (state) => {
          return {
            hasApi: true,
            stateCount: state.count,
          };
        }
      );

      const result2 = store.executeSlice(apiSlice);
      expect(result2).toEqual({
        hasApi: true,
        stateCount: 5,
      });
    });

    it('should allow slices to execute other slices via API', () => {
      const store = new TestStore({ x: 10, y: 20 });

      // Create simple slices that don't use API
      const xSlice = createSlice(
        createModel<{ x: number; y: number }>(() => ({ x: 0, y: 0 })),
        (state) => state.x
      );

      const ySlice = createSlice(
        createModel<{ x: number; y: number }>(() => ({ x: 0, y: 0 })),
        (state) => state.y
      );

      // Create a slice that uses API to compose other slices
      const sumSlice = createSlice(
        createModel<{ x: number; y: number }>(() => ({ x: 0, y: 0 })),
        (m) => {
          // Use the API to execute other slices
          const x = xSlice(m);
          const y = ySlice(m);
          return x + y;
        }
      );

      const result = store.executeSlice(sumSlice);
      expect(result).toBe(30);
    });

    it('should cache slice results', () => {
      const store = new TestStore({ count: 0 });
      let executionCount = 0;

      const slice = createSlice(
        createModel<{ count: number }>(() => ({ count: 0 })),
        (state) => {
          executionCount++;
          return { count: state.count };
        }
      );

      // Execute twice
      store.executeSlice(slice);
      store.executeSlice(slice);

      // Should only execute once due to caching
      expect(executionCount).toBe(1);
    });

    it('should clear cache on state change', () => {
      const store = new TestStore({ count: 0 });
      let executionCount = 0;

      const slice = createSlice(
        createModel<{ count: number }>(() => ({ count: 0 })),
        (state) => {
          executionCount++;
          return { count: state.count };
        }
      );

      // Execute once
      store.executeSlice(slice);
      expect(executionCount).toBe(1);

      // Change state
      store.setState({ count: 1 });

      // Execute again - should not use cache
      store.executeSlice(slice);
      expect(executionCount).toBe(2);
    });

    it('should notify subscribers on state change', () => {
      const store = new TestStore({ count: 0 });
      let notificationCount = 0;

      store.subscribe(() => {
        notificationCount++;
      });

      store.setState({ count: 1 });
      expect(notificationCount).toBe(1);
    });
  });

  describe('createTestAdapter', () => {
    it('should create a store from a model factory', () => {
      const modelFactory: ModelFactory<{
        count: number;
        increment: () => void;
      }> = ({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      });

      const store = createTestAdapter(modelFactory);

      expect(store.getState().count).toBe(0);

      // Execute increment
      store.getState().increment();
      expect(store.getState().count).toBe(1);
    });
  });

  describe('Test', () => {
    it('should create a test harness with API support', () => {
      const component = () => ({
        model: createModel<{ count: number }>(() => ({ count: 0 })),
        actions: createSlice(
          createModel<{ count: number }>(() => ({ count: 0 })),
          (state) => ({
            increment: () => state.count + 1,
          })
        ),
        views: {
          countView: createSlice(
            createModel<{ count: number }>(() => ({ count: 0 })),
            (state) => ({ value: state.count })
          ),
        },
      });

      const test = createComponentTest(component);

      expect(test.getState()).toEqual({ count: 0 });
      expect(test.api).toBeDefined();
    });

    it('should support computed views that use API', () => {
      const baseModel = createModel<{ items: string[] }>(() => ({
        items: ['a', 'b', 'c'],
      }));

      const itemCountSlice = createSlice(
        baseModel,
        (state) => state.items.length
      );

      const component = () => ({
        model: baseModel,
        actions: createSlice(baseModel, () => ({})),
        views: {
          // Computed view that uses API to execute another slice
          summary: () =>
            createSlice(baseModel, (m) => {
              const count = itemCountSlice(m);
              return { itemCount: count, hasItems: count > 0 };
            }),
        },
      });

      const test = createComponentTest(component);
      const summary = test.getView('summary');

      expect(summary).toEqual({ itemCount: 3, hasItems: true });
    });
  });
}
