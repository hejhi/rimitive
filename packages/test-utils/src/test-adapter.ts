import type {
  SliceFactory,
  ModelFactory,
  ComponentFactory,
  ComponentSpec,
} from '@lattice/core';
import { SLICE_FACTORY_MARKER } from '@lattice/core';

// Define types locally
type StateSubscriber<T> = (state: T) => void;

/**
 * Test store implementation that properly executes slice factories
 * and resolves select() markers
 */
export class TestStore<TState> {
  private state: TState;
  private subscribers = new Set<StateSubscriber<TState>>();
  private sliceCache = new Map<SliceFactory<any, any>, any>();

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
    this.subscribers.forEach(listener => listener(this.state));
  }

  /**
   * Execute a slice factory
   */
  executeSlice<TResult>(sliceFactory: SliceFactory<TState, TResult>): TResult {
    // Check cache first
    if (this.sliceCache.has(sliceFactory)) {
      return this.sliceCache.get(sliceFactory);
    }

    try {
      // Execute the slice factory with the state
      const result = sliceFactory(this.state);
      
      // Cache the result
      this.sliceCache.set(sliceFactory, result);
      
      return result;
    } catch (error) {
      console.error('Error executing slice:', error);
      console.error('State:', this.state);
      console.error('SliceFactory:', sliceFactory);
      throw error;
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
    set: (partial) => { tempState = { ...tempState, ...partial }; },
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
export function createComponentTest<
  Model = any,
  Actions = any,
  Views = any
>(
  componentFactory: ComponentFactory<Model, Actions, Views>
): {
  store: TestStore<Model>;
  component: ComponentSpec<Model, Actions, Views>;
  getState: () => Model;
  getActions: () => Actions;
  getSlice: <T>(sliceFactory: SliceFactory<Model, T>) => T;
  getView: (viewName: keyof Views) => any;
} {
  const component = componentFactory();
  const store = createTestAdapter(component.model);

  return {
    store,
    component,
    getState: () => store.getState(),
    getActions: () => store.executeSlice(component.actions),
    getSlice: (sliceFactory) => store.executeSlice(sliceFactory),
    getView: (viewName) => {
      const view = component.views[viewName];
      
      // Helper to check if something is a slice factory
      const isSliceFactory = (value: any): value is SliceFactory<Model, any> => {
        return typeof value === 'function' && SLICE_FACTORY_MARKER in value;
      };
      
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

  describe('TestStore', () => {
    it('should execute slice factories', () => {
      const store = new TestStore({ count: 0, name: 'test' });
      
      const slice = ((state: { count: number; name: string }) => {
        return { count: state.count };
      }) as SliceFactory<{ count: number; name: string }, { count: number }>;

      const result = store.executeSlice(slice);
      expect(result).toEqual({ count: 0 });
    });

    it('should cache slice results', () => {
      const store = new TestStore({ count: 0 });
      let executionCount = 0;
      
      const slice = ((state: { count: number }) => {
        executionCount++;
        return { count: state.count };
      }) as SliceFactory<{ count: number }, { count: number }>;

      // Execute twice
      store.executeSlice(slice);
      store.executeSlice(slice);

      // Should only execute once due to caching
      expect(executionCount).toBe(1);
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
      const modelFactory: ModelFactory<{ count: number; increment: () => void }> = 
        ({ set, get }) => ({
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
}