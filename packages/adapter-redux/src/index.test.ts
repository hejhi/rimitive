import { describe, it, expect } from 'vitest';
import { createReduxAdapter } from './index';
import {
  createModel,
  createSlice,
  createAdapterTestSuite,
} from '@lattice/core';

describe('Redux Adapter', () => {
  it('should export createReduxAdapter function', () => {
    expect(createReduxAdapter).toBeDefined();
    expect(typeof createReduxAdapter).toBe('function');
  });

  it('should create a working Redux store with basic counter', () => {
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
        increment: m().increment,
        decrement: m().decrement,
      }));

      return {
        model,
        actions,
        views: {},
      };
    };

    const store = createReduxAdapter(counter);

    // Verify initial state
    expect(store.getState().count).toBe(0);

    // Test increment
    store.actions.increment();
    expect(store.getState().count).toBe(1);

    // Test decrement
    store.actions.decrement();
    expect(store.getState().count).toBe(0);

    // Multiple operations
    store.actions.increment();
    store.actions.increment();
    store.actions.increment();
    expect(store.getState().count).toBe(3);
  });

  it('should support complex state updates', () => {
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
    }

    const todoApp = () => {
      const model = createModel<{
        todos: Todo[];
        filter: 'all' | 'active' | 'completed';
        addTodo: (text: string) => void;
        toggleTodo: (id: number) => void;
        setFilter: (filter: 'all' | 'active' | 'completed') => void;
      }>(({ set, get }) => ({
        todos: [],
        filter: 'all',
        addTodo: (text) => {
          const newTodo: Todo = {
            id: Date.now(),
            text,
            completed: false,
          };
          set({ todos: [...get().todos, newTodo] });
        },
        toggleTodo: (id) => {
          set({
            todos: get().todos.map((todo) =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            ),
          });
        },
        setFilter: (filter) => set({ filter }),
      }));

      const actions = createSlice(model, (m) => ({
        addTodo: m().addTodo,
        toggleTodo: m().toggleTodo,
        setFilter: m().setFilter,
      }));

      return {
        model,
        actions,
        views: {},
      };
    };

    const store = createReduxAdapter(todoApp);

    // Add todos
    store.actions.addTodo('First todo');
    store.actions.addTodo('Second todo');

    expect(store.getState().todos.length).toBe(2);
    expect(store.getState().todos[0]?.text).toBe('First todo');
    expect(store.getState().todos[0]?.completed).toBe(false);

    // Toggle todo
    const firstTodoId = store.getState().todos[0]?.id;
    if (firstTodoId !== undefined) {
      store.actions.toggleTodo(firstTodoId);
    }

    expect(store.getState().todos[0]?.completed).toBe(true);

    // Set filter
    store.actions.setFilter('completed');
    expect(store.getState().filter).toBe('completed');
  });
});

// Run the shared adapter test suite
createAdapterTestSuite('Redux', createReduxAdapter);