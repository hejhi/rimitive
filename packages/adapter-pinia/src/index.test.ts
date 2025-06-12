import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia, defineStore } from 'pinia';
import { createPiniaAdapter, wrapPiniaStore } from './index';

// Import types from core
import type { StoreTools } from '@lattice/core';

describe('Pinia Adapter', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());
  });

  it('should create a store with the new API', () => {
    const createComponent = (createStore: any) => {
      const createSlice = createStore({ count: 0 });

      const counter = createSlice(
        ({ get, set }: StoreTools<{ count: number }>) => ({
          count: () => get().count,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          reset: () => set({ count: 0 }),
        })
      );

      return { counter };
    };

    const store = createPiniaAdapter(createComponent);

    // Test initial state
    expect(store.counter.count()).toBe(0);

    // Test increment
    store.counter.increment();
    expect(store.counter.count()).toBe(1);

    // Test decrement
    store.counter.decrement();
    store.counter.decrement();
    expect(store.counter.count()).toBe(-1);

    // Test reset
    store.counter.reset();
    expect(store.counter.count()).toBe(0);
  });

  it('should support subscriptions', () => {
    const createComponent = (createStore: any) => {
      const createSlice = createStore({ value: 0 });

      const state = createSlice(
        ({ get, set }: StoreTools<{ value: number }>) => ({
          value: () => get().value,
          setValue: (v: number) => set({ value: v }),
        })
      );

      return { state };
    };

    const store = createPiniaAdapter(createComponent);

    // Track subscription calls
    let callCount = 0;
    const unsubscribe = store.subscribe(() => {
      callCount++;
    });

    // Initial state
    expect(store.state.value()).toBe(0);
    expect(callCount).toBe(0);

    // Update state
    store.state.setValue(42);
    expect(store.state.value()).toBe(42);
    expect(callCount).toBe(1);

    // Another update
    store.state.setValue(100);
    expect(store.state.value()).toBe(100);
    expect(callCount).toBe(2);

    // Unsubscribe
    unsubscribe();
    store.state.setValue(200);
    expect(callCount).toBe(2); // No more calls
  });

  it('should handle multiple slices sharing state', async () => {
    const createComponent = (createStore: any) => {
      const createSlice = createStore({
        todos: [] as Array<{ id: number; text: string; done: boolean }>,
        filter: 'all' as 'all' | 'active' | 'completed',
      });

      const actions = createSlice(({ get, set }: StoreTools<any>) => ({
        addTodo: (text: string) => {
          const todos = get().todos;
          set({
            todos: [...todos, { id: Date.now(), text, done: false }],
          });
        },
        toggleTodo: (id: number) => {
          const todos = get().todos;
          set({
            todos: todos.map((todo: any) =>
              todo.id === id ? { ...todo, done: !todo.done } : todo
            ),
          });
        },
        setFilter: (filter: 'all' | 'active' | 'completed') => {
          set({ filter });
        },
      }));

      const queries = createSlice(({ get }: { get: () => any }) => ({
        allTodos: () => get().todos,
        activeTodos: () => get().todos.filter((t: any) => !t.done),
        completedTodos: () => get().todos.filter((t: any) => t.done),
        visibleTodos: () => {
          const todos = get().todos;
          const filter = get().filter;
          switch (filter) {
            case 'active':
              return todos.filter((t: any) => !t.done);
            case 'completed':
              return todos.filter((t: any) => t.done);
            default:
              return todos;
          }
        },
        currentFilter: () => get().filter,
      }));

      return { actions, queries };
    };

    const store = createPiniaAdapter(createComponent);

    // Test initial state
    expect(store.queries.allTodos()).toEqual([]);
    expect(store.queries.currentFilter()).toBe('all');

    // Add todos with a small delay to ensure different IDs
    store.actions.addTodo('Learn Lattice');
    // Wait a millisecond to ensure Date.now() returns different values
    await new Promise((resolve) => setTimeout(resolve, 1));
    store.actions.addTodo('Build a component');

    const todos = store.queries.allTodos();
    expect(todos).toHaveLength(2);
    expect(todos[0].text).toBe('Learn Lattice');
    expect(todos[1].text).toBe('Build a component');

    // Toggle todo
    const firstTodoId = todos[0].id;
    store.actions.toggleTodo(firstTodoId);

    expect(store.queries.activeTodos()).toHaveLength(1);
    expect(store.queries.completedTodos()).toHaveLength(1);

    // Test filtering
    store.actions.setFilter('active');
    expect(store.queries.visibleTodos()).toHaveLength(1);
    expect(store.queries.visibleTodos()[0].text).toBe('Build a component');

    store.actions.setFilter('completed');
    expect(store.queries.visibleTodos()).toHaveLength(1);
    expect(store.queries.visibleTodos()[0].text).toBe('Learn Lattice');
  });

  it('should work with enhancer for plugins', () => {
    let enhancerCalled = false;

    const createComponent = (createStore: any) => {
      const createSlice = createStore({
        user: null as { name: string; email: string } | null,
        isLoggedIn: false,
      });

      const auth = createSlice(({ get, set }: StoreTools<any>) => ({
        login: (name: string, email: string) => {
          set({ user: { name, email }, isLoggedIn: true });
        },
        logout: () => {
          set({ user: null, isLoggedIn: false });
        },
        currentUser: () => get().user,
        isAuthenticated: () => get().isLoggedIn,
      }));

      return { auth };
    };

    const store = createPiniaAdapter(
      createComponent,
      (stateCreator, pinia, storeId) => {
        enhancerCalled = true;

        // Could add plugins here, e.g.:
        // pinia.use(createPersistedState({ key: id => `__persisted__${id}` }));

        const useStore = defineStore(storeId, {
          state: stateCreator,
        });

        return useStore(pinia);
      }
    );

    // Enhancer should have been called
    expect(enhancerCalled).toBe(true);

    // Store should work normally
    expect(store.auth.isAuthenticated()).toBe(false);
    expect(store.auth.currentUser()).toBeNull();

    store.auth.login('Alice', 'alice@example.com');
    expect(store.auth.isAuthenticated()).toBe(true);
    expect(store.auth.currentUser()).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('should handle errors in listeners gracefully', () => {
    const errors: unknown[] = [];

    const createComponent = (createStore: any) => {
      const createSlice = createStore({ value: 0 });

      const counter = createSlice(
        ({ get, set }: StoreTools<{ value: number }>) => ({
          value: () => get().value,
          increment: () => set({ value: get().value + 1 }),
        })
      );

      return { counter };
    };

    const store = createPiniaAdapter(createComponent, undefined, {
      onError: (error) => errors.push(error),
    });

    // Add a listener that throws
    store.subscribe(() => {
      throw new Error('Listener error');
    });

    // Add a normal listener
    let normalListenerCalled = false;
    store.subscribe(() => {
      normalListenerCalled = true;
    });

    // Trigger an update
    store.counter.increment();

    // Error should be captured
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe('Listener error');

    // Normal listener should still be called
    expect(normalListenerCalled).toBe(true);
  });

  it('should support wrapPiniaStore', () => {
    // Create a Pinia store manually
    const useManualStore = defineStore('manual', {
      state: () => ({ count: 10 }),
    });

    const piniaStore = useManualStore();

    // Wrap it as an adapter
    const adapter = wrapPiniaStore(piniaStore);

    // Test adapter interface
    expect(adapter.getState()).toEqual({ count: 10 });

    adapter.setState({ count: 20 });
    expect(adapter.getState()).toEqual({ count: 20 });

    // Test subscriptions
    let callCount = 0;
    const unsubscribe = adapter.subscribe(() => {
      callCount++;
    });

    adapter.setState({ count: 30 });
    expect(callCount).toBe(1);

    unsubscribe();
    adapter.setState({ count: 40 });
    expect(callCount).toBe(1); // No more calls
  });
});
