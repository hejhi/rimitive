import { describe, it, expect, vi } from 'vitest';
import {
  configureStore,
  createSlice as createReduxSlice,
} from '@reduxjs/toolkit';
import { reduxAdapter } from './index';

describe('Redux Adapter', () => {
  it('should wrap an existing Redux store', () => {
    // Create a Redux store using native API
    const counterSlice = createReduxSlice({
      name: 'counter',
      initialState: { value: 0 },
      reducers: {
        increment: (state) => {
          state.value += 1;
        },
        decrement: (state) => {
          state.value -= 1;
        },
        incrementBy: (state, action) => {
          state.value += action.payload;
        },
      },
    });

    const store = configureStore({
      reducer: {
        counter: counterSlice.reducer,
      },
    });

    // Wrap it with the adapter
    const createSlice = reduxAdapter(store);

    // Create a Lattice component
    const counter = createSlice(({ get, set }) => ({
      count: () => get().counter.value,
      increment: () =>
        set({
          counter: { value: get().counter.value + 1 },
        }),
      decrement: () =>
        set({
          counter: { value: get().counter.value - 1 },
        }),
    }));

    // Test initial state
    expect(counter.selector.count()).toBe(0);

    // Test Lattice methods
    counter.selector.increment();
    expect(counter.selector.count()).toBe(1);

    counter.selector.decrement();
    expect(counter.selector.count()).toBe(0);
  });

  it('should work with native Redux actions', () => {
    const counterSlice = createReduxSlice({
      name: 'counter',
      initialState: { value: 0 },
      reducers: {
        increment: (state) => {
          state.value += 1;
        },
        incrementBy: (state, action) => {
          state.value += action.payload;
        },
      },
    });

    const store = configureStore({
      reducer: {
        counter: counterSlice.reducer,
      },
    });

    const createSlice = reduxAdapter(store);

    const counter = createSlice(({ get }) => ({
      count: () => get().counter.value,
    }));

    // Test that native Redux actions still work
    expect(counter.selector.count()).toBe(0);

    store.dispatch(counterSlice.actions.increment());
    expect(counter.selector.count()).toBe(1);

    store.dispatch(counterSlice.actions.incrementBy(5));
    expect(counter.selector.count()).toBe(6);
  });

  it('should support subscriptions', () => {
    const slice = createReduxSlice({
      name: 'test',
      initialState: { value: 0 },
      reducers: {
        setValue: (state, action) => {
          state.value = action.payload;
        },
      },
    });

    const store = configureStore({
      reducer: slice.reducer,
    });

    const createLatticeSlice = reduxAdapter(store);
    const state = createLatticeSlice(({ get }) => ({
      value: () => get().value,
    }));

    const callback = vi.fn();
    const unsubscribe = state.subscribe(callback);

    // Trigger state change
    store.dispatch(slice.actions.setValue(1));

    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe and verify no more calls
    unsubscribe();
    store.dispatch(slice.actions.setValue(2));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should work with middleware', () => {
    const loggerMiddleware = () => (next: any) => (action: any) => {
      console.log('Action:', action.type);
      return next(action);
    };

    const slice = createReduxSlice({
      name: 'test',
      initialState: { value: 0 },
      reducers: {
        increment: (state) => {
          state.value += 1;
        },
      },
    });

    const store = configureStore({
      reducer: slice.reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(loggerMiddleware),
    });

    const createLatticeSlice = reduxAdapter(store);
    const counter = createLatticeSlice(({ get }) => ({
      value: () => get().value,
    }));

    expect(counter.selector.value()).toBe(0);

    // Dispatch action through Redux
    store.dispatch(slice.actions.increment());
    expect(counter.selector.value()).toBe(1);
  });

  it('should work with complex state shapes', () => {
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
    }

    interface AppState {
      todos: Todo[];
      filter: 'all' | 'active' | 'completed';
    }

    const todosSlice = createReduxSlice({
      name: 'todos',
      initialState: {
        items: [] as Todo[],
        filter: 'all' as AppState['filter'],
      },
      reducers: {
        addTodo: (state, action) => {
          state.items.push({
            id: Date.now(),
            text: action.payload,
            completed: false,
          });
        },
        toggleTodo: (state, action) => {
          const todo = state.items.find((t) => t.id === action.payload);
          if (todo) {
            todo.completed = !todo.completed;
          }
        },
        setFilter: (state, action) => {
          state.filter = action.payload;
        },
      },
    });

    const store = configureStore({
      reducer: {
        todos: todosSlice.reducer,
      },
    });

    const createSlice = reduxAdapter(store);

    const actions = createSlice(({ get, set }) => ({
      addTodo: (text: string) => {
        const todos = get().todos;
        set({
          todos: {
            ...todos,
            items: [...todos.items, { id: Date.now(), text, completed: false }],
          },
        });
      },
      toggleTodo: (id: number) => {
        const todos = get().todos;
        set({
          todos: {
            ...todos,
            items: todos.items.map((t) =>
              t.id === id ? { ...t, completed: !t.completed } : t
            ),
          },
        });
      },
      setFilter: (filter: AppState['filter']) => {
        const todos = get().todos;
        set({
          todos: {
            ...todos,
            filter,
          },
        });
      },
    }));

    const queries = createSlice(({ get }) => ({
      allTodos: () => get().todos.items,
      activeTodos: () => get().todos.items.filter((t) => !t.completed),
      completedTodos: () => get().todos.items.filter((t) => t.completed),
      visibleTodos: () => {
        const { items, filter } = get().todos;
        if (filter === 'active') return items.filter((t) => !t.completed);
        if (filter === 'completed') return items.filter((t) => t.completed);
        return items;
      },
    }));

    // Add todos
    actions.selector.addTodo('Learn Lattice');
    actions.selector.addTodo('Build a component');

    const todos = queries.selector.allTodos();
    expect(todos).toHaveLength(2);
    expect(todos[0]?.text).toBe('Learn Lattice');
    expect(todos[1]?.text).toBe('Build a component');

    // Toggle todo
    const firstTodoId = todos[0]?.id;
    firstTodoId && actions.selector.toggleTodo(firstTodoId);

    expect(queries.selector.activeTodos()).toHaveLength(1);
    expect(queries.selector.completedTodos()).toHaveLength(1);

    // Test filtering
    actions.selector.setFilter('active');
    expect(queries.selector.visibleTodos()).toHaveLength(1);
    expect(queries.selector.visibleTodos()[0]?.text).toBe('Build a component');

    actions.selector.setFilter('completed');
    expect(queries.selector.visibleTodos()).toHaveLength(1);
    expect(queries.selector.visibleTodos()[0]?.text).toBe('Learn Lattice');
  });

  it('should handle errors in listeners gracefully', () => {
    const errors: unknown[] = [];

    const slice = createReduxSlice({
      name: 'test',
      initialState: { value: 0 },
      reducers: {
        setValue: (state, action) => {
          state.value = action.payload;
        },
      },
    });

    const store = configureStore({
      reducer: slice.reducer,
    });

    const createLatticeSlice = reduxAdapter(store, {
      onError: (error) => errors.push(error),
    });

    const state = createLatticeSlice(({ get }) => ({
      value: () => get().value,
    }));

    // Subscribe with a listener that throws
    const errorListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const normalListener = vi.fn();

    state.subscribe(errorListener);
    state.subscribe(normalListener);

    // Trigger state change
    store.dispatch(slice.actions.setValue(1));

    // Error listener threw, but normal listener should still be called
    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(normalListener).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe('Listener error');
  });

  it('should handle unsubscribe during notification', () => {
    const slice = createReduxSlice({
      name: 'test',
      initialState: { value: 0 },
      reducers: {
        setValue: (state, action) => {
          state.value = action.payload;
        },
      },
    });

    const store = configureStore({
      reducer: slice.reducer,
    });

    const createLatticeSlice = reduxAdapter(store);
    const state = createLatticeSlice(({ get, set }) => ({
      value: () => get().value,
      setValue: (value: number) => set({ value }),
    }));

    let callsA = 0;
    let callsB = 0;
    let callsC = 0;
    let unsubscribeB: (() => void) | null = null;

    // Listener A: increments counter
    state.subscribe(() => {
      callsA++;
    });

    // Listener B: unsubscribes itself
    unsubscribeB = state.subscribe(() => {
      callsB++;
      unsubscribeB?.();
    });

    // Listener C: increments counter
    state.subscribe(() => {
      callsC++;
    });

    // Trigger notification
    state.selector.setValue(1);

    // All listeners should be called once
    expect(callsA).toBe(1);
    expect(callsB).toBe(1);
    expect(callsC).toBe(1);

    // Trigger another notification
    state.selector.setValue(2);

    // A and C should be called again, B should not
    expect(callsA).toBe(2);
    expect(callsB).toBe(1); // Still 1
    expect(callsC).toBe(2);
  });

  it('should work with Redux DevTools', () => {
    const slice = createReduxSlice({
      name: 'counter',
      initialState: { value: 0 },
      reducers: {
        increment: (state) => {
          state.value += 1;
        },
      },
    });

    const store = configureStore({
      reducer: {
        counter: slice.reducer,
      },
      devTools: true,
    });

    const createLatticeSlice = reduxAdapter(store);
    const counter = createLatticeSlice(({ get }) => ({
      value: () => get().counter.value,
    }));

    // DevTools should work transparently
    expect(counter.selector.value()).toBe(0);
    store.dispatch(slice.actions.increment());
    expect(counter.selector.value()).toBe(1);
  });
});
