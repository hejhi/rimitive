import { describe, it, expect } from 'vitest';
import { createReduxAdapter, createStoreAdapter } from './index';
import { createAdapterTestSuite } from '@lattice/core';

describe('Redux Adapter', () => {
  it('should export createReduxAdapter function', () => {
    expect(createReduxAdapter).toBeDefined();
    expect(typeof createReduxAdapter).toBe('function');
  });

  it('should create a working Redux store with basic counter', () => {
    const createComponent = (createStore: any) => {
      const createSlice = createStore({ count: 0 });

      const counter = createSlice(({ get, set }: any) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      return { counter };
    };

    const store = createReduxAdapter(createComponent);

    // Verify initial state
    expect(store.counter.selector.count()).toBe(0);

    // Test increment
    store.counter.selector.increment();
    expect(store.counter.selector.count()).toBe(1);

    // Test decrement
    store.counter.selector.decrement();
    expect(store.counter.selector.count()).toBe(0);

    // Multiple operations
    store.counter.selector.increment();
    store.counter.selector.increment();
    store.counter.selector.increment();
    expect(store.counter.selector.count()).toBe(3);
  });

  it('should support complex state updates', () => {
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
    }

    const createComponent = (createStore: any) => {
      const createSlice = createStore({
        todos: [] as Todo[],
        filter: 'all' as 'all' | 'active' | 'completed',
      });

      let nextId = 1;
      const actions = createSlice(({ get, set }: any) => ({
        addTodo: (text: string) => {
          const newTodo: Todo = {
            id: nextId++,
            text,
            completed: false,
          };
          set({ todos: [...get().todos, newTodo] });
        },
        toggleTodo: (id: number) => {
          set({
            todos: get().todos.map((todo: Todo) =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            ),
          });
        },
        setFilter: (filter: 'all' | 'active' | 'completed') => set({ filter }),
      }));

      const queries = createSlice(({ get }: any) => ({
        todos: () => get().todos,
        filter: () => get().filter,
        activeTodos: () => get().todos.filter((t: Todo) => !t.completed),
        completedTodos: () => get().todos.filter((t: Todo) => t.completed),
      }));

      return { actions, queries };
    };

    const store = createReduxAdapter(createComponent);

    // Add todos
    store.actions.selector.addTodo('First todo');
    store.actions.selector.addTodo('Second todo');

    expect(store.queries.selector.todos().length).toBe(2);
    expect(store.queries.selector.todos()[0]?.text).toBe('First todo');
    expect(store.queries.selector.todos()[0]?.completed).toBe(false);

    // Toggle todo
    const firstTodoId = store.queries.selector.todos()[0]?.id;
    if (firstTodoId !== undefined) {
      store.actions.selector.toggleTodo(firstTodoId);
    }

    expect(store.queries.selector.todos()[0]?.completed).toBe(true);
    expect(store.queries.selector.completedTodos().length).toBe(1);
    expect(store.queries.selector.activeTodos().length).toBe(1);

    // Set filter
    store.actions.selector.setFilter('completed');
    expect(store.queries.selector.filter()).toBe('completed');
  });
});

// Run the shared adapter test suite
createAdapterTestSuite('Redux', createStoreAdapter);
