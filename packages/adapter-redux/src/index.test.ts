import { describe, it, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { latticeReducer, reduxAdapter } from './index';

describe('Redux Adapter', () => {
  it('should create a Redux store with Lattice slices', () => {
    const store = configureStore({
      reducer: latticeReducer.reducer,
      preloadedState: {
        counter: { value: 0 },
      },
    });

    const createSlice = reduxAdapter<{ counter: { value: number } }>(store);

    const counter = createSlice(({ counter }) => ({
      count: () => counter().value, // computed from signal
      increment: () => counter({ value: counter().value + 1 }),
      decrement: () => counter({ value: counter().value - 1 }),
    }));

    // Test initial state
    expect(counter().count()).toBe(0);

    // Test increment
    counter().increment();
    expect(counter().count()).toBe(1);
    expect(store.getState().counter.value).toBe(1);

    // Test decrement
    counter().decrement();
    expect(counter().count()).toBe(0);
  });

  it('should handle multiple slices', () => {
    type CountStore = {
      counter: { value: number };
      user: { name: string; loggedIn: boolean };
    };

    const store = configureStore<CountStore>({
      reducer: latticeReducer.reducer,
      preloadedState: {
        counter: { value: 0 },
        user: { name: '', loggedIn: false },
      },
    });

    const createSlice = reduxAdapter<CountStore>(store);

    const counter = createSlice(({ counter }) => ({
      value: () => counter().value,
      increment: () => counter({ value: counter().value + 1 }),
    }));

    const user = createSlice(({ user }) => ({
      getName: () => user().name,
      isLoggedIn: () => user().loggedIn,
      login: (name: string) => user({ name, loggedIn: true }),
      logout: () => user({ name: '', loggedIn: false }),
    }));

    // Test both slices work independently
    counter().increment();
    user().login('Alice');

    expect(counter().value()).toBe(1);
    expect(user().getName()).toBe('Alice');
    expect(user().isLoggedIn()).toBe(true);

    // Verify Redux store has both updates
    expect(store.getState()).toEqual({
      counter: { value: 1 },
      user: { name: 'Alice', loggedIn: true },
    });
  });

  it('should support subscriptions', async () => {
    const store = configureStore({
      reducer: latticeReducer.reducer,
      preloadedState: { value: 0 },
    });

    const createSlice = reduxAdapter<{ value: number }>(store);

    const state = createSlice(({ value }) => ({
      value,
      setValue: (newValue: number) => value(newValue),
    }));

    const callback = vi.fn();
    const unsubscribe = state().value.subscribe(callback);

    // Trigger state change
    state().setValue(1);

    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe and verify no more calls
    unsubscribe();
    state().setValue(2);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should work with Redux DevTools', () => {
    const store = configureStore({
      reducer: latticeReducer.reducer,
      preloadedState: {
        counter: { value: 0 },
      },
    });

    const createSlice = reduxAdapter<{ counter: { value: number } }>(store);

    const counter = createSlice(({ counter }) => ({
      value: () => counter().value,
      increment: () => counter({ value: counter().value + 1 }),
    }));

    // DevTools will see 'lattice/updateState' actions
    counter().increment();
    expect(counter().value()).toBe(1);

    // Can still access Redux store directly
    expect(store.getState().counter.value).toBe(1);
  });

  it('should handle complex state updates', () => {
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
    }

    const store = configureStore({
      reducer: latticeReducer.reducer,
      preloadedState: {
        todos: {
          items: [] as Todo[],
          filter: 'all' as 'all' | 'active' | 'completed',
        },
      },
    });

    const createSlice = reduxAdapter<{
      todos: {
        items: Todo[];
        filter: 'all' | 'active' | 'completed';
      };
    }>(store);

    let nextId = 1;
    const todos = createSlice(({ todos }) => ({
      getAll: () => todos().items,
      getActive: () => todos().items.filter((t) => !t.completed),
      getCompleted: () => todos().items.filter((t) => t.completed),

      addTodo: (text: string) => {
        todos({
          ...todos(),
          items: [
            ...todos().items,
            {
              id: nextId++,
              text,
              completed: false,
            },
          ],
        });
      },

      toggleTodo: (id: number) => {
        todos({
          ...todos(),
          items: todos().items.map((todo) =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          ),
        });
      },

      setFilter: (filter: 'all' | 'active' | 'completed') => {
        todos({
          ...todos(),
          filter,
        });
      },
    }));

    // Add todos
    todos().addTodo('Learn Lattice');
    todos().addTodo('Build app');

    expect(todos().getAll()).toHaveLength(2);
    expect(todos().getActive()).toHaveLength(2);
    expect(todos().getCompleted()).toHaveLength(0);

    // Toggle first todo
    const allTodos = todos().getAll();
    expect(allTodos[0]).toBeDefined();
    const firstId = allTodos[0]!.id;
    todos().toggleTodo(firstId);

    expect(todos().getActive()).toHaveLength(1);
    expect(todos().getCompleted()).toHaveLength(1);

    // Change filter
    todos().setFilter('active');
    expect(store.getState().todos.filter).toBe('active');
  });

  it('should handle errors in listeners gracefully', async () => {
    const errors: unknown[] = [];

    // Create store with custom error handler
    const store = configureStore({
      reducer: latticeReducer.reducer,
      preloadedState: { value: 0 },
    });

    const createSlice = reduxAdapter<{ value: number }>(store, {
      onError: (error) => errors.push(error),
    });

    const state = createSlice(({ value }) => ({
      value,
      setValue: (newValue: number) => value(newValue),
    }));

    // Subscribe with a normal listener first
    const normalListener = vi.fn();
    state().value.subscribe(normalListener);

    // Subscribe with a listener that throws
    const errorListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    state().value.subscribe(errorListener);

    // Trigger state change - in signals-first API, errors in signal listeners will throw
    expect(() => state().setValue(1)).toThrow('Listener error');

    // Normal listener should be called before error occurs
    expect(normalListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledTimes(1);
  });

  it('should handle nested state updates', () => {
    const store = configureStore({
      reducer: latticeReducer.reducer,
      preloadedState: {
        ui: {
          modal: {
            isOpen: false,
            content: null as string | null,
          },
          theme: 'light',
        },
      },
    });

    const createSlice = reduxAdapter<{
      ui: {
        modal: {
          isOpen: boolean;
          content: string | null;
        };
        theme: string;
      };
    }>(store);

    const ui = createSlice(({ ui }) => ({
      isModalOpen: () => ui().modal.isOpen,
      getModalContent: () => ui().modal.content,
      getTheme: () => ui().theme,

      openModal: (content: string) => {
        ui({
          ...ui(),
          modal: { isOpen: true, content },
        });
      },

      closeModal: () => {
        ui({
          ...ui(),
          modal: { isOpen: false, content: null },
        });
      },

      toggleTheme: () => {
        ui({
          ...ui(),
          theme: ui().theme === 'light' ? 'dark' : 'light',
        });
      },
    }));

    // Test modal operations
    expect(ui().isModalOpen()).toBe(false);

    ui().openModal('Hello World');
    expect(ui().isModalOpen()).toBe(true);
    expect(ui().getModalContent()).toBe('Hello World');

    ui().closeModal();
    expect(ui().isModalOpen()).toBe(false);
    expect(ui().getModalContent()).toBe(null);

    // Test theme toggle
    expect(ui().getTheme()).toBe('light');
    ui().toggleTheme();
    expect(ui().getTheme()).toBe('dark');
  });

  it('should work with Redux store slices', () => {
    const store = configureStore({
      reducer: {
        app: latticeReducer.reducer,
        // Other Redux slices could be here
      },
      preloadedState: {
        app: {
          count: 0,
          user: { name: '' },
        },
      },
    });

    const createSlice = reduxAdapter<{
      count: number;
      user: { name: string };
    }>(store, { slice: 'app' });

    const counter = createSlice(({ count }) => ({
      value: () => count(),
      increment: () => count(count() + 1),
    }));

    expect(counter().value()).toBe(0);
    counter().increment();
    expect(counter().value()).toBe(1);

    // Check that the state is correctly scoped to the 'app' slice
    expect(store.getState().app.count).toBe(1);
  });
});
