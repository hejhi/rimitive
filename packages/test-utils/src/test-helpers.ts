import type {
  ComponentFactory,
  SliceFactory,
  ModelFactory,
  AdapterAPI,
} from '@lattice/core';
import { SLICE_FACTORY_MARKER } from '@lattice/core';
import { createTestAdapter, TestStore } from './test-adapter.js';

/**
 * Creates a mock AdapterAPI for testing slices in isolation
 */
export function createMockAPI<Model>(initialState: Model): AdapterAPI<Model> {
  const store = new TestStore(initialState);
  return store;
}

/**
 * Helper to test a single slice in isolation
 */
export function testSlice<TState, TResult>(
  initialState: TState,
  sliceFactory: SliceFactory<TState, TResult>
): {
  store: TestStore<TState>;
  getResult: () => TResult;
  setState: (partial: Partial<TState>) => void;
} {
  const store = new TestStore(initialState);

  return {
    store,
    getResult: () => store.executeSlice(sliceFactory),
    setState: (partial) => store.setState(partial),
  };
}

/**
 * Helper to test a model factory
 */
export function testModel<TModel>(modelFactory: ModelFactory<TModel>): {
  store: TestStore<TModel>;
  model: TModel;
  setState: (partial: Partial<TModel>) => void;
} {
  const store = createTestAdapter(modelFactory);

  return {
    store,
    model: store.getState(),
    setState: (partial) => store.setState(partial),
  };
}

/**
 * Helper to test view outputs
 */
export function testView<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>,
  viewName: keyof Views
): {
  store: TestStore<Model>;
  getViewOutput: () => unknown;
  executeAction: (actionName: keyof Actions, ...args: unknown[]) => void;
  setState: (partial: Partial<Model>) => void;
} {
  const component = componentFactory();
  const store = createTestAdapter(component.model);

  return {
    store,
    getViewOutput: () => {
      const view = component.views[viewName];

      // Helper to check if something is a slice factory
      const isSliceFactory = (
        value: unknown
      ): value is SliceFactory<Model, unknown> => {
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
    executeAction: (actionName: keyof Actions, ...args: unknown[]) => {
      const actions = store.executeSlice(component.actions);
      const action = actions[actionName];
      if (typeof action === 'function') {
        (action as (...args: unknown[]) => void)(...args);
      }
    },
    setState: (partial) => store.setState(partial),
  };
}

/**
 * Snapshot testing helper
 */
export function createSnapshot<T>(value: T): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Helper to wait for state changes
 */
export async function waitForState<TState>(
  store: TestStore<TState>,
  predicate: (state: TState) => boolean,
  timeout = 1000
): Promise<TState> {
  return new Promise((resolve, reject) => {
    // Check immediately
    if (predicate(store.getState())) {
      resolve(store.getState());
      return;
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error('Timeout waiting for state change'));
    }, timeout);

    // Subscribe to changes
    const unsubscribe = store.subscribe((state) => {
      if (predicate(state)) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(state);
      }
    });
  });
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createComponent, createModel, createSlice } = await import(
    '@lattice/core'
  );

  describe('testSlice', () => {
    it('should test a slice in isolation', () => {
      const slice = ((state: { count: number }) => {
        return { doubled: state.count * 2 };
      }) as SliceFactory<{ count: number }, { doubled: number }>;

      const { getResult, setState } = testSlice({ count: 5 }, slice);

      expect(getResult()).toEqual({ doubled: 10 });

      setState({ count: 10 });
      // Clear cache to get fresh result
      const { getResult: getResult2 } = testSlice({ count: 10 }, slice);
      expect(getResult2()).toEqual({ doubled: 20 });
    });
  });

  describe('testModel', () => {
    it('should test a model factory', () => {
      const modelFactory: ModelFactory<{
        count: number;
        increment: () => void;
      }> = ({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      });

      const { model, store } = testModel(modelFactory);

      expect(model.count).toBe(0);

      model.increment();
      expect(store.getState().count).toBe(1);
    });
  });

  describe('testView', () => {
    it('should test view outputs', () => {
      const counter = createComponent(() => {
        const model = createModel<{ count: number; increment: () => void }>(
          ({ set, get }) => ({
            count: 0,
            increment: () => set({ count: get().count + 1 }),
          })
        );

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const counterView = createSlice(model, (m) => ({
          value: m.count,
          className: m.count > 5 ? 'high' : 'low',
        }));

        return {
          model,
          actions,
          views: {
            counter: counterView,
          },
        };
      });

      const { getViewOutput, executeAction } = testView(counter, 'counter');

      expect(getViewOutput()).toEqual({
        value: 0,
        className: 'low',
      });

      executeAction('increment');
      executeAction('increment');
      executeAction('increment');
      executeAction('increment');
      executeAction('increment');
      executeAction('increment');

      expect(getViewOutput()).toEqual({
        value: 6,
        className: 'high',
      });
    });
  });

  describe('waitForState', () => {
    it('should wait for state to match predicate', async () => {
      const store = new TestStore({ count: 0 });

      // Simulate async state change
      setTimeout(() => {
        store.setState({ count: 5 });
      }, 50);

      const state = await waitForState(store, (s) => s.count === 5);
      expect(state.count).toBe(5);
    });

    it('should timeout if state never matches', async () => {
      const store = new TestStore({ count: 0 });

      await expect(
        waitForState(store, (s) => s.count === 5, 50)
      ).rejects.toThrow('Timeout waiting for state change');
    }, 500);
  });
}
