import { describe, it, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { createLatticeReducer, reduxAdapter } from './index';
import { createComponent, withState, createStoreWithAdapter } from '@lattice/core';

describe('Redux Adapter', () => {
  it('should create a Redux store with Lattice components', () => {
    const store = configureStore({
      reducer: createLatticeReducer<{ counter: { value: number } }>(),
      preloadedState: {
        counter: { value: 0 },
      },
    });

    const adapter = reduxAdapter<{ counter: { value: number } }>(store);

    const Counter = createComponent(
      withState<{ counter: { value: number } }>(),
      ({ store, set }) => ({
        count: () => store.counter().value,
        increment: () => set(state => ({ counter: { value: state.counter().value + 1 } })),
        decrement: () => set(state => ({ counter: { value: state.counter().value - 1 } })),
      })
    );

    const counter = createStoreWithAdapter(Counter, adapter);

    // Test initial state
    expect(counter.count()).toBe(0);

    // Test increment
    counter.increment();
    expect(counter.count()).toBe(1);
    expect(store.getState().counter.value).toBe(1);

    // Test decrement
    counter.decrement();
    expect(counter.count()).toBe(0);
  });

  it('should handle multiple slices', () => {
    type CountStore = {
      counter: { value: number };
      user: { name: string; loggedIn: boolean };
    };

    const store = configureStore<CountStore>({
      reducer: createLatticeReducer<CountStore>(),
      preloadedState: {
        counter: { value: 0 },
        user: { name: '', loggedIn: false },
      },
    });

    const adapter = reduxAdapter<CountStore>(store);

    const CounterComponent = createComponent(
      withState<CountStore>(),
      ({ store, set }) => ({
        count: () => store.counter().value,
        increment: () => set(state => ({ 
          counter: { value: state.counter().value + 1 } 
        })),
      })
    );

    const UserComponent = createComponent(
      withState<CountStore>(),
      ({ store, set }) => ({
        name: () => store.user().name,
        loggedIn: () => store.user().loggedIn,
        login: (name: string) => set({ user: { name, loggedIn: true } }),
        logout: () => set({ user: { name: '', loggedIn: false } }),
      })
    );

    const counter = createStoreWithAdapter(CounterComponent, adapter);
    const user = createStoreWithAdapter(UserComponent, adapter);

    // Test counter slice
    expect(counter.count()).toBe(0);
    counter.increment();
    expect(counter.count()).toBe(1);

    // Test user slice
    expect(user.name()).toBe('');
    expect(user.loggedIn()).toBe(false);
    user.login('Alice');
    expect(user.name()).toBe('Alice');
    expect(user.loggedIn()).toBe(true);

    // Verify Redux state
    const state = store.getState();
    expect(state.counter.value).toBe(1);
    expect(state.user.name).toBe('Alice');
    expect(state.user.loggedIn).toBe(true);
  });

  it('should work with computed values', () => {
    type AppState = {
      value: number;
    };

    const store = configureStore<AppState>({
      reducer: createLatticeReducer<AppState>(),
      preloadedState: { value: 5 },
    });

    const adapter = reduxAdapter<AppState>(store);

    const App = createComponent(
      withState<AppState>(),
      ({ store, computed, set }) => ({
        value: store.value,
        doubled: computed(() => store.value() * 2),
        tripled: computed(() => store.value() * 3),
        setValue: (n: number) => set({ value: n }),
      })
    );

    const app = createStoreWithAdapter(App, adapter);

    expect(app.value()).toBe(5);
    expect(app.doubled()).toBe(10);
    expect(app.tripled()).toBe(15);

    app.setValue(10);
    expect(app.value()).toBe(10);
    expect(app.doubled()).toBe(20);
    expect(app.tripled()).toBe(30);
  });

  it('should batch updates', () => {
    type CounterState = {
      counter: { a: number; b: number };
    };

    const store = configureStore<CounterState>({
      reducer: createLatticeReducer<CounterState>(),
      preloadedState: {
        counter: { a: 0, b: 0 },
      },
    });

    const adapter = reduxAdapter<CounterState>(store);
    let notifyCount = 0;

    const Counter = createComponent(
      withState<CounterState>(),
      ({ store, computed, set }) => ({
        a: store.counter,
        sum: computed(() => {
          notifyCount++;
          return store.counter().a + store.counter().b;
        }),
        incrementBoth: () => set(state => ({
          counter: {
            a: state.counter().a + 1,
            b: state.counter().b + 1,
          },
        })),
      })
    );

    const counter = createStoreWithAdapter(Counter, adapter);

    // First access to establish computed
    expect(counter.sum()).toBe(0);
    expect(notifyCount).toBe(1); // First evaluation
    
    counter.incrementBoth();
    expect(counter.sum()).toBe(2);
    
    // Should have evaluated twice total - once for initial, once after update
    expect(notifyCount).toBe(2);
  });

  it('should support arrays and complex state', () => {
    type TodoState = {
      todos: Array<{ id: number; text: string; done: boolean }>;
      filter: 'all' | 'active' | 'done';
      nextId: number;
    };

    const store = configureStore<TodoState>({
      reducer: createLatticeReducer<TodoState>(),
      preloadedState: {
        todos: [],
        filter: 'all',
        nextId: 1,
      },
    });

    const adapter = reduxAdapter<TodoState>(store);

    const TodoApp = createComponent(
      withState<TodoState>(),
      ({ store, computed, set }) => ({
        todos: store.todos,
        filter: store.filter,
        filtered: computed(() => {
          const todos = store.todos();
          const filter = store.filter();
          if (filter === 'all') return todos;
          return filter === 'active' 
            ? todos.filter(t => !t.done)
            : todos.filter(t => t.done);
        }),
        addTodo: (text: string) => set(state => ({
          todos: [...state.todos(), { id: state.nextId(), text, done: false }],
          nextId: state.nextId() + 1,
        })),
        toggleTodo: (id: number) => set(state => ({
          todos: state.todos().map(todo =>
            todo.id === id ? { ...todo, done: !todo.done } : todo
          ),
        })),
        setFilter: (filter: 'all' | 'active' | 'done') => set({ filter }),
      })
    );

    const app = createStoreWithAdapter(TodoApp, adapter);

    // Add todos
    app.addTodo('Buy milk');
    app.addTodo('Read book');
    expect(app.todos()).toHaveLength(2);
    expect(app.filtered()).toHaveLength(2);

    // Toggle first todo
    const todos = app.todos();
    expect(todos[0]).toBeDefined();
    expect(todos[0]!.text).toBe('Buy milk');
    expect(todos[1]!.text).toBe('Read book');
    
    const firstId = todos[0]!.id;
    app.toggleTodo(firstId);
    const updatedTodos = app.todos();
    expect(updatedTodos[0]?.done).toBe(true);
    expect(updatedTodos[0]?.text).toBe('Buy milk');
    expect(updatedTodos[1]?.done).toBe(false);
    expect(updatedTodos[1]?.text).toBe('Read book');

    // Filter
    app.setFilter('active');
    const activeTodos = app.filtered();
    expect(activeTodos).toHaveLength(1);
    expect(activeTodos[0]?.text).toBe('Read book');

    app.setFilter('done');
    const doneTodos = app.filtered();
    expect(doneTodos).toHaveLength(1);
    expect(doneTodos[0]?.text).toBe('Buy milk');
  });

  it('should handle subscriptions correctly', () => {
    type State = {
      value: number;
    };

    const store = configureStore<State>({
      reducer: createLatticeReducer<State>(),
      preloadedState: { value: 0 },
    });

    const adapter = reduxAdapter<State>(store);
    const listener = vi.fn();

    const unsubscribe = adapter.subscribe(listener);

    // Update state
    adapter.setState({ value: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    // Update again
    adapter.setState({ value: 2 });
    expect(listener).toHaveBeenCalledTimes(2);

    // Unsubscribe
    unsubscribe();
    adapter.setState({ value: 3 });
    expect(listener).toHaveBeenCalledTimes(2); // Not called after unsubscribe
  });

  it('should handle errors in listeners', () => {
    const errorHandler = vi.fn();
    const store = configureStore({
      reducer: createLatticeReducer<{ value: number }>(),
      preloadedState: { value: 0 },
    });

    const adapter = reduxAdapter<{ value: number }>(store, {
      onError: errorHandler,
    });

    const errorListener = () => {
      throw new Error('Test error');
    };

    adapter.subscribe(errorListener);
    adapter.setState({ value: 1 });

    expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' })
    );
  });

  it('should work with slice option', () => {
    type FullState = {
      ui: { theme: 'light' | 'dark'; sidebarOpen: boolean };
      data: { items: string[] };
    };

    const store = configureStore<FullState>({
      reducer: createLatticeReducer<FullState>(),
      preloadedState: {
        ui: { theme: 'light', sidebarOpen: false },
        data: { items: [] },
      },
    });

    type UIState = FullState['ui'];
    const adapter = reduxAdapter<UIState>(store, { slice: 'ui' });

    const UIComponent = createComponent(
      withState<UIState>(),
      ({ store, set }) => ({
        theme: store.theme,
        sidebarOpen: store.sidebarOpen,
        toggleTheme: () => set(state => ({
          theme: state.theme() === 'light' ? 'dark' : 'light',
        })),
        toggleSidebar: () => set(state => ({
          sidebarOpen: !state.sidebarOpen(),
        })),
      })
    );

    const ui = createStoreWithAdapter(UIComponent, adapter);

    expect(ui.theme()).toBe('light');
    expect(ui.sidebarOpen()).toBe(false);

    ui.toggleTheme();
    expect(ui.theme()).toBe('dark');

    ui.toggleSidebar();
    expect(ui.sidebarOpen()).toBe(true);

    // Check that only UI slice was affected
    const fullState = store.getState();
    expect(fullState.ui.theme).toBe('dark');
    expect(fullState.ui.sidebarOpen).toBe(true);
    expect(fullState.data.items).toEqual([]); // Unchanged
  });

  it('should handle concurrent updates during notification', () => {
    const store = configureStore({
      reducer: createLatticeReducer<{ value: number }>(),
      preloadedState: { value: 0 },
    });

    const adapter = reduxAdapter<{ value: number }>(store);
    const results: number[] = [];

    // Listener that triggers another update
    adapter.subscribe(() => {
      const state = adapter.getState();
      results.push(state.value);
      if (state.value === 1) {
        adapter.setState({ value: 2 });
      }
    });

    adapter.setState({ value: 1 });

    // Should have seen both updates
    expect(results).toEqual([1, 2]);
    expect(adapter.getState().value).toBe(2);
  });

  it('should support functional updates', () => {
    type State = {
      count: number;
      multiplier: number;
    };

    const store = configureStore<State>({
      reducer: createLatticeReducer<State>(),
      preloadedState: { count: 5, multiplier: 2 },
    });

    const adapter = reduxAdapter<State>(store);

    const Counter = createComponent(
      withState<State>(),
      ({ store, computed, set }) => ({
        count: store.count,
        multiplier: store.multiplier,
        product: computed(() => store.count() * store.multiplier()),
        doubleCount: () => set(state => ({
          count: state.count() * 2,
        })),
        incrementMultiplier: () => set(state => ({
          multiplier: state.multiplier() + 1,
        })),
      })
    );

    const counter = createStoreWithAdapter(Counter, adapter);

    expect(counter.product()).toBe(10);

    counter.doubleCount();
    expect(counter.count()).toBe(10);
    expect(counter.product()).toBe(20);

    counter.incrementMultiplier();
    expect(counter.multiplier()).toBe(3);
    expect(counter.product()).toBe(30);
  });
});