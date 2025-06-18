import { describe, it, expect, vi } from 'vitest';
import { createStore } from './index';

describe('Redux Adapter', () => {
  it('should create a Redux store with Lattice slices', () => {
    const { store, createSlice } = createStore({
      counter: { value: 0 },
    });

    const counter = createSlice(({ get, set }) => ({
      count: () => get().counter.value,
      increment: () => set({
        counter: { value: get().counter.value + 1 }
      }),
      decrement: () => set({
        counter: { value: get().counter.value - 1 }
      }),
    }));

    // Test initial state
    expect(counter.selector.count()).toBe(0);

    // Test increment
    counter.selector.increment();
    expect(counter.selector.count()).toBe(1);
    expect(store.getState().counter.value).toBe(1);

    // Test decrement
    counter.selector.decrement();
    expect(counter.selector.count()).toBe(0);
  });

  it('should handle multiple slices', () => {
    const { store, createSlice } = createStore({
      counter: { value: 0 },
      user: { name: '', loggedIn: false },
    });

    const counter = createSlice(({ get, set }) => ({
      value: () => get().counter.value,
      increment: () => set({
        counter: { value: get().counter.value + 1 }
      }),
    }));

    const user = createSlice(({ get, set }) => ({
      getName: () => get().user.name,
      isLoggedIn: () => get().user.loggedIn,
      login: (name: string) => set({
        user: { name, loggedIn: true }
      }),
      logout: () => set({
        user: { name: '', loggedIn: false }
      }),
    }));

    // Test both slices work independently
    counter.selector.increment();
    user.selector.login('Alice');

    expect(counter.selector.value()).toBe(1);
    expect(user.selector.getName()).toBe('Alice');
    expect(user.selector.isLoggedIn()).toBe(true);

    // Verify Redux store has both updates
    expect(store.getState()).toEqual({
      counter: { value: 1 },
      user: { name: 'Alice', loggedIn: true },
    });
  });

  it('should support subscriptions', () => {
    const { createSlice } = createStore({ value: 0 });

    const state = createSlice(({ get, set }) => ({
      value: () => get().value,
      setValue: (value: number) => set({ value }),
    }));

    const callback = vi.fn();
    const unsubscribe = state.subscribe(callback);

    // Trigger state change
    state.selector.setValue(1);

    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe and verify no more calls
    unsubscribe();
    state.selector.setValue(2);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should work with Redux DevTools', () => {
    const { store, createSlice } = createStore({
      counter: { value: 0 },
    });

    const counter = createSlice(({ get, set }) => ({
      value: () => get().counter.value,
      increment: () => set({
        counter: { value: get().counter.value + 1 }
      }),
    }));

    // DevTools will see 'lattice/batchUpdate' actions
    counter.selector.increment();
    expect(counter.selector.value()).toBe(1);

    // Can still access Redux store directly
    expect(store.getState().counter.value).toBe(1);
  });

  it('should handle complex state updates', () => {
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
    }

    const { store, createSlice } = createStore({
      todos: {
        items: [] as Todo[],
        filter: 'all' as 'all' | 'active' | 'completed',
      },
    });

    let nextId = 1;
    const todos = createSlice(({ get, set }) => ({
      getAll: () => get().todos.items,
      getActive: () => get().todos.items.filter(t => !t.completed),
      getCompleted: () => get().todos.items.filter(t => t.completed),
      
      addTodo: (text: string) => {
        set({
          todos: {
            ...get().todos,
            items: [...get().todos.items, {
              id: nextId++,
              text,
              completed: false,
            }],
          },
        });
      },
      
      toggleTodo: (id: number) => {
        set({
          todos: {
            ...get().todos,
            items: get().todos.items.map(todo =>
              todo.id === id
                ? { ...todo, completed: !todo.completed }
                : todo
            ),
          },
        });
      },
      
      setFilter: (filter: 'all' | 'active' | 'completed') => {
        set({
          todos: {
            ...get().todos,
            filter,
          },
        });
      },
    }));

    // Add todos
    todos.selector.addTodo('Learn Lattice');
    todos.selector.addTodo('Build app');

    expect(todos.selector.getAll()).toHaveLength(2);
    expect(todos.selector.getActive()).toHaveLength(2);
    expect(todos.selector.getCompleted()).toHaveLength(0);

    // Toggle first todo
    const allTodos = todos.selector.getAll();
    expect(allTodos[0]).toBeDefined();
    const firstId = allTodos[0]!.id;
    todos.selector.toggleTodo(firstId);

    expect(todos.selector.getActive()).toHaveLength(1);
    expect(todos.selector.getCompleted()).toHaveLength(1);

    // Change filter
    todos.selector.setFilter('active');
    expect(store.getState().todos.filter).toBe('active');
  });

  it('should handle errors in listeners gracefully', () => {
    const errors: unknown[] = [];
    
    // Note: Our implementation logs errors to console by default
    // In a real app, you might want to pass a custom error handler
    const originalError = console.error;
    console.error = (error: unknown) => errors.push(error);

    const { createSlice } = createStore({ value: 0 });

    const state = createSlice(({ get, set }) => ({
      value: () => get().value,
      setValue: (value: number) => set({ value }),
    }));

    // Subscribe with a listener that throws
    const errorListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const normalListener = vi.fn();

    state.subscribe(errorListener);
    state.subscribe(normalListener);

    // Trigger state change
    state.selector.setValue(1);

    // Error listener threw, but normal listener should still be called
    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(normalListener).toHaveBeenCalledTimes(1);

    // Restore console.error
    console.error = originalError;
  });

  it('should handle nested state updates', () => {
    const { createSlice } = createStore({
      ui: {
        modal: {
          isOpen: false,
          content: null as string | null,
        },
        theme: 'light',
      },
    });

    const ui = createSlice(({ get, set }) => ({
      isModalOpen: () => get().ui.modal.isOpen,
      getModalContent: () => get().ui.modal.content,
      getTheme: () => get().ui.theme,
      
      openModal: (content: string) => {
        set({
          ui: {
            ...get().ui,
            modal: { isOpen: true, content },
          },
        });
      },
      
      closeModal: () => {
        set({
          ui: {
            ...get().ui,
            modal: { isOpen: false, content: null },
          },
        });
      },
      
      toggleTheme: () => {
        set({
          ui: {
            ...get().ui,
            theme: get().ui.theme === 'light' ? 'dark' : 'light',
          },
        });
      },
    }));

    // Test modal operations
    expect(ui.selector.isModalOpen()).toBe(false);
    
    ui.selector.openModal('Hello World');
    expect(ui.selector.isModalOpen()).toBe(true);
    expect(ui.selector.getModalContent()).toBe('Hello World');
    
    ui.selector.closeModal();
    expect(ui.selector.isModalOpen()).toBe(false);
    expect(ui.selector.getModalContent()).toBe(null);
    
    // Test theme toggle
    expect(ui.selector.getTheme()).toBe('light');
    ui.selector.toggleTheme();
    expect(ui.selector.getTheme()).toBe('dark');
  });
});