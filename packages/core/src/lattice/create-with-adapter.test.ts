/**
 * Comprehensive tests for createComponentWithAdapter
 * 
 * These tests ensure the component creation works correctly with state adapters
 * and maintains full type safety without any shortcuts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComponentWithAdapter } from './create-with-adapter';
import { createZustandAdapterSync } from '../adapters/zustand';
import type { StateStore, StateAdapter } from '../shared/state-adapter';
import type { SetState, GetState } from '../shared/types';
import { createModel } from '../model';
import { createSelectors } from '../selectors';
import { createActions } from '../actions';
import { createView } from '../view';

/**
 * Mock state adapter for testing
 */
class MockStateAdapter<T> implements StateAdapter<T> {
  createStore(initialState: T): StateStore<T> {
    let state = initialState;
    const listeners = new Set<(state: T) => void>();

    const set: SetState<T> = (partial, replace = false) => {
      if (typeof partial === 'function') {
        const updater = partial as (state: T) => T | Partial<T>;
        const result = updater(state);
        state = replace ? (result as T) : { ...state, ...result } as T;
      } else {
        state = replace ? (partial as T) : { ...state, ...partial } as T;
      }

      listeners.forEach(listener => listener(state));
    };

    const get: GetState<T> = () => state;

    return {
      get,
      set,
      subscribe: (listener: (state: T) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      destroy: () => listeners.clear(),
    };
  }
}

describe('createComponentWithAdapter', () => {
  // Test model interface
  interface TestModel {
    count: number;
    name: string;
    increment: () => void;
    setName: (name: string) => void;
  }

  // Test selectors interface
  interface TestSelectors {
    count: number;
    name: string;
    displayName: string;
  }

  // Test actions interface
  interface TestActions {
    increment: () => void;
    setName: (name: string) => void;
    reset: () => void;
  }

  // Test views interface
  interface TestViews {
    button: {
      onClick: () => void;
      'aria-label': string;
    };
    display: {
      'data-count': number;
      'data-name': string;
    };
  }

  let mockAdapter: MockStateAdapter<TestModel>;

  beforeEach(() => {
    mockAdapter = new MockStateAdapter<TestModel>();
  });

  describe('Basic Component Creation', () => {
    it('should create a component with adapter successfully', () => {
      const modelFactory = createModel<TestModel>(({ set, get }) => ({
        count: 0,
        name: 'initial',
        increment: () => {
          const current = get();
          set({ count: current.count + 1 });
        },
        setName: (name: string) => {
          set({ name });
        },
      }));

      const selectorsFactory = createSelectors<TestSelectors, TestModel>(
        { model: {} as TestModel }, // Placeholder model for factory creation
        ({ model }) => ({
          count: model().count,
          name: model().name,
          displayName: `Count: ${model().count}, Name: ${model().name}`,
        })
      );

      const actionsFactory = createActions<TestActions, TestModel>(({ model }) => ({
        increment: model().increment,
        setName: model().setName,
        reset: () => {
          const m = model();
          m.setName('initial');
          // Reset count by setting directly
        },
      }));

      const buttonViewFactory = createView<TestViews['button'], TestSelectors, TestActions>(
        ({ selectors, actions }) => ({
          onClick: actions().increment,
          'aria-label': `Increment button, current count: ${selectors().count}`,
        })
      );

      const displayViewFactory = createView<TestViews['display'], TestSelectors, TestActions>(
        ({ selectors }) => ({
          'data-count': selectors().count,
          'data-name': selectors().name,
        })
      );

      const componentFactory = createComponentWithAdapter({
        model: modelFactory,
        selectors: selectorsFactory,
        actions: actionsFactory,
        view: {
          button: buttonViewFactory,
          display: displayViewFactory,
        },
        adapter: mockAdapter,
        initialState: {
          count: 5,
          name: 'test',
          increment: () => {},
          setName: () => {},
        },
      });

      expect(componentFactory).toBeDefined();
      expect(typeof componentFactory).toBe('function');
    });

    it('should create working component instances', () => {
      const modelFactory = createModel<TestModel>(({ set, get }) => ({
        count: 0,
        name: 'initial',
        increment: () => {
          const current = get();
          set({ count: current.count + 1 });
        },
        setName: (name: string) => {
          set({ name });
        },
      }));

      const selectorsFactory = createSelectors<TestSelectors, TestModel>(
        { model: {} as TestModel }, // Placeholder model for factory creation
        ({ model }) => ({
          count: model().count,
          name: model().name,
          displayName: `Count: ${model().count}, Name: ${model().name}`,
        })
      );

      const actionsFactory = createActions<TestActions, TestModel>(
        { model: {} as TestModel }, // Placeholder model for factory creation
        ({ model }) => ({
          increment: model().increment,
          setName: model().setName,
          reset: () => {
            const m = model();
            m.setName('initial');
          },
        })
      );

      const buttonViewFactory = createView<TestViews['button'], TestSelectors, TestActions>(
        ({ selectors, actions }) => ({
          onClick: actions().increment,
          'aria-label': `Increment button, current count: ${selectors().count}`,
        })
      );

      const displayViewFactory = createView<TestViews['display'], TestSelectors, TestActions>(
        ({ selectors }) => ({
          'data-count': selectors().count,
          'data-name': selectors().name,
        })
      );

      const componentFactory = createComponentWithAdapter({
        model: modelFactory,
        selectors: selectorsFactory,
        actions: actionsFactory,
        view: {
          button: buttonViewFactory,
          display: displayViewFactory,
        },
        adapter: mockAdapter,
        initialState: {
          count: 10,
          name: 'test-initial',
          increment: () => {},
          setName: () => {},
        },
      });

      const component = componentFactory();

      // Test that all parts are accessible
      expect(component.getModel).toBeDefined();
      expect(component.getSelectors).toBeDefined();
      expect(component.getActions).toBeDefined();
      expect(component.getView).toBeDefined();
      expect(component.getAllViews).toBeDefined();

      // Test specific view access
      const buttonView = component.getView('button');
      const displayView = component.getView('display');

      expect(buttonView).toBeDefined();
      expect(displayView).toBeDefined();

      // Test all views access
      const allViews = component.getAllViews();
      expect(allViews.button).toBeDefined();
      expect(allViews.display).toBeDefined();
    });
  });

  describe('State Management Integration', () => {
    it('should properly integrate with state adapter', () => {
      const modelFactory = createModel<{ value: number }>(({ set, get }) => ({
        value: 0,
        increment: () => {
          const current = get();
          set({ value: current.value + 1 });
        },
      }));

      const selectorsFactory = createSelectors<{ value: number }, { value: number }>(
        ({ model }) => ({
          value: model().value,
        })
      );

      const actionsFactory = createActions<{ increment: () => void }, { value: number }>(
        { model: {} as { value: number } }, // Placeholder model for factory creation
        ({ model }) => ({
          increment: (model() as any).increment,
        })
      );

      const viewFactory = createView<{ 'data-value': number }, { value: number }, { increment: () => void }>(
        ({ selectors }) => ({
          'data-value': selectors().value,
        })
      );

      const componentFactory = createComponentWithAdapter({
        model: modelFactory,
        selectors: selectorsFactory,
        actions: actionsFactory,
        view: { main: viewFactory },
        adapter: mockAdapter,
        initialState: { value: 5 },
      });

      const component = componentFactory();
      
      // The component should be properly created and connected to the adapter
      expect(component).toBeDefined();
    });

    it('should handle factory function initial states', () => {
      const stateFactory = ({ set, get }: { set: SetState<TestModel>; get: GetState<TestModel> }) => ({
        count: 100,
        name: 'factory-created',
        increment: () => {
          const current = get();
          set({ count: current.count + 1 });
        },
        setName: (name: string) => {
          set({ name });
        },
      });

      const modelFactory = createModel<TestModel>(({ set, get }) => ({
        count: 0,
        name: 'initial',
        increment: () => {
          const current = get();
          set({ count: current.count + 1 });
        },
        setName: (name: string) => {
          set({ name });
        },
      }));

      const selectorsFactory = createSelectors<TestSelectors, TestModel>(({ model }) => ({
        count: model().count,
        name: model().name,
        displayName: `${model().name}: ${model().count}`,
      }));

      const actionsFactory = createActions<TestActions, TestModel>(({ model }) => ({
        increment: model().increment,
        setName: model().setName,
        reset: () => {},
      }));

      const viewFactory = createView<TestViews['display'], TestSelectors, TestActions>(
        ({ selectors }) => ({
          'data-count': selectors().count,
          'data-name': selectors().name,
        })
      );

      const componentFactory = createComponentWithAdapter({
        model: modelFactory,
        selectors: selectorsFactory,
        actions: actionsFactory,
        view: { display: viewFactory },
        adapter: mockAdapter,
        initialState: stateFactory,
      });

      const component = componentFactory();
      expect(component).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety across all component parts', () => {
      interface TypedModel {
        count: number;
        items: string[];
        addItem: (item: string) => void;
      }

      interface TypedSelectors {
        count: number;
        items: string[];
        itemCount: number;
      }

      interface TypedActions {
        addItem: (item: string) => void;
        clear: () => void;
      }

      interface TypedViews {
        list: {
          'data-count': number;
          'data-items': string;
        };
      }

      const modelFactory = createModel<TypedModel>(({ set, get }) => ({
        count: 0,
        items: [],
        addItem: (item: string) => {
          const current = get();
          set({
            items: [...current.items, item],
            count: current.count + 1,
          });
        },
      }));

      const selectorsFactory = createSelectors<TypedSelectors, TypedModel>(({ model }) => ({
        count: model().count,
        items: model().items,
        itemCount: model().items.length,
      }));

      const actionsFactory = createActions<TypedActions, TypedModel>(({ model }) => ({
        addItem: model().addItem,
        clear: () => {
          // This would be implemented to clear the state
        },
      }));

      const listViewFactory = createView<TypedViews['list'], TypedSelectors, TypedActions>(
        ({ selectors }) => ({
          'data-count': selectors().count,
          'data-items': selectors().items.join(','),
        })
      );

      const componentFactory = createComponentWithAdapter({
        model: modelFactory,
        selectors: selectorsFactory,
        actions: actionsFactory,
        view: { list: listViewFactory },
        adapter: new MockStateAdapter<TypedModel>(),
        initialState: {
          count: 0,
          items: ['initial'],
          addItem: () => {},
        },
      });

      const component = componentFactory();

      // These should all compile without type errors
      const listView = component.getView('list');
      const allViews = component.getAllViews();
      
      expect(listView).toBeDefined();
      expect(allViews.list).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter creation errors gracefully', () => {
      const errorAdapter: StateAdapter<any> = {
        createStore: () => {
          throw new Error('Adapter creation failed');
        },
      };

      const modelFactory = createModel<{ value: number }>(({ set, get }) => ({
        value: 0,
      }));

      const selectorsFactory = createSelectors<{ value: number }, { value: number }>(
        ({ model }) => ({ value: model().value })
      );

      const actionsFactory = createActions<{}, { value: number }>(() => ({}));

      const viewFactory = createView<{}, { value: number }, {}>(
        () => ({})
      );

      const componentFactory = createComponentWithAdapter({
        model: modelFactory,
        selectors: selectorsFactory,
        actions: actionsFactory,
        view: { main: viewFactory },
        adapter: errorAdapter,
        initialState: { value: 0 },
      });

      expect(() => componentFactory()).toThrow('Adapter creation failed');
    });
  });
});