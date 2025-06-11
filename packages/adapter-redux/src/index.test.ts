import { describe, it, expect } from 'vitest';
import { createReduxAdapter, createStoreAdapter } from './index';
import { createAdapterTestSuite } from '@lattice/core';

describe('Redux Adapter', () => {
  it('should export createReduxAdapter function', () => {
    expect(createReduxAdapter).toBeDefined();
    expect(typeof createReduxAdapter).toBe('function');
  });

  it('should create a working Redux store with basic counter', () => {
    const createApp = (createStore: any) => {
      const createSlice = createStore({ count: 0 });

      const counter = createSlice(({ get, set }: any) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      return { counter };
    };

    const store = createReduxAdapter(createApp);

    // Verify initial state
    expect(store.counter.count()).toBe(0);

    // Test increment
    store.counter.increment();
    expect(store.counter.count()).toBe(1);

    // Test decrement
    store.counter.decrement();
    expect(store.counter.count()).toBe(0);

    // Multiple operations
    store.counter.increment();
    store.counter.increment();
    store.counter.increment();
    expect(store.counter.count()).toBe(3);
  });

  it('should support complex state updates', () => {
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
    }


    const createApp = (createStore: any) => {
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

    const store = createReduxAdapter(createApp);

    // Add todos
    store.actions.addTodo('First todo');
    store.actions.addTodo('Second todo');

    expect(store.queries.todos().length).toBe(2);
    expect(store.queries.todos()[0]?.text).toBe('First todo');
    expect(store.queries.todos()[0]?.completed).toBe(false);

    // Toggle todo
    const firstTodoId = store.queries.todos()[0]?.id;
    if (firstTodoId !== undefined) {
      store.actions.toggleTodo(firstTodoId);
    }

    expect(store.queries.todos()[0]?.completed).toBe(true);
    expect(store.queries.completedTodos().length).toBe(1);
    expect(store.queries.activeTodos().length).toBe(1);

    // Set filter
    store.actions.setFilter('completed');
    expect(store.queries.filter()).toBe('completed');
  });
});

// Run the shared adapter test suite
createAdapterTestSuite('Redux', createStoreAdapter);