import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia, defineStore } from 'pinia';
import { piniaAdapter } from './index';

describe('Pinia Adapter', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());
  });

  it('should wrap an existing Pinia store', () => {
    // Create a Pinia store using native API
    const useCounterStore = defineStore('counter', {
      state: () => ({ count: 0 }),
    });

    const store = useCounterStore();

    // Wrap it with the adapter
    const createSlice = piniaAdapter(store);

    // Create a Lattice component
    const counter = createSlice(({ get, set }) => ({
      count: () => get().count,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 }),
      reset: () => set({ count: 0 }),
    }));

    // Test initial state
    expect(counter.selector.count()).toBe(0);

    // Test increment
    counter.selector.increment();
    expect(counter.selector.count()).toBe(1);

    // Test decrement
    counter.selector.decrement();
    counter.selector.decrement();
    expect(counter.selector.count()).toBe(-1);

    // Test reset
    counter.selector.reset();
    expect(counter.selector.count()).toBe(0);
  });

  it('should preserve Pinia store actions', () => {
    // Create a Pinia store with actions
    const useCounterStore = defineStore('counter', {
      state: () => ({ count: 0 }),
      actions: {
        increment() {
          this.count++;
        },
        incrementBy(amount: number) {
          this.count += amount;
        },
      },
    });

    const store = useCounterStore();
    const createSlice = piniaAdapter(store);

    const counter = createSlice(({ get }) => ({
      count: () => get().count,
    }));

    // Test that native Pinia actions still work
    expect(counter.selector.count()).toBe(0);

    store.increment();
    expect(counter.selector.count()).toBe(1);

    store.incrementBy(5);
    expect(counter.selector.count()).toBe(6);
  });

  it('should support subscriptions', () => {
    const useStore = defineStore('test', {
      state: () => ({ value: 0 }),
    });

    const store = useStore();
    const createSlice = piniaAdapter(store);

    const state = createSlice(({ get, set }) => ({
      value: () => get().value,
      setValue: (v: number) => set({ value: v }),
    }));

    // Track subscription calls
    let callCount = 0;
    const unsubscribe = state.subscribe(() => {
      callCount++;
    });

    // Initial state
    expect(state.selector.value()).toBe(0);
    expect(callCount).toBe(0);

    // Update state
    state.selector.setValue(42);
    expect(state.selector.value()).toBe(42);
    expect(callCount).toBe(1);

    // Another update
    state.selector.setValue(100);
    expect(state.selector.value()).toBe(100);
    expect(callCount).toBe(2);

    // Unsubscribe
    unsubscribe();
    state.selector.setValue(200);
    expect(callCount).toBe(2); // No more calls
  });

  it('should handle multiple slices sharing state', async () => {
    interface TodoState {
      todos: Array<{ id: number; text: string; done: boolean }>;
      filter: 'all' | 'active' | 'completed';
    }

    const useTodoStore = defineStore('todos', {
      state: (): TodoState => ({
        todos: [],
        filter: 'all',
      }),
    });

    const store = useTodoStore();
    const createSlice = piniaAdapter(store);

    const actions = createSlice(({ get, set }) => ({
      addTodo: (text: string) => {
        const todos = get().todos;
        set({
          todos: [...todos, { id: Date.now(), text, done: false }],
        });
      },
      toggleTodo: (id: number) => {
        const todos = get().todos;
        set({
          todos: todos.map((todo) =>
            todo.id === id ? { ...todo, done: !todo.done } : todo
          ),
        });
      },
      setFilter: (filter: 'all' | 'active' | 'completed') => {
        set({ filter });
      },
    }));

    const queries = createSlice(({ get }) => ({
      allTodos: () => get().todos,
      activeTodos: () => get().todos.filter((t) => !t.done),
      completedTodos: () => get().todos.filter((t) => t.done),
      visibleTodos: () => {
        const todos = get().todos;
        const filter = get().filter;
        switch (filter) {
          case 'active':
            return todos.filter((t) => !t.done);
          case 'completed':
            return todos.filter((t) => t.done);
          default:
            return todos;
        }
      },
      currentFilter: () => get().filter,
    }));

    // Test initial state
    expect(queries.selector.allTodos()).toEqual([]);
    expect(queries.selector.currentFilter()).toBe('all');

    // Add todos with a small delay to ensure different IDs
    actions.selector.addTodo('Learn Lattice');
    await new Promise((resolve) => setTimeout(resolve, 1));
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

    const useStore = defineStore('test', {
      state: () => ({ value: 0 }),
    });

    const store = useStore();
    const createSlice = piniaAdapter(store, {
      onError: (error) => errors.push(error),
    });

    const counter = createSlice(({ get, set }) => ({
      value: () => get().value,
      increment: () => set({ value: get().value + 1 }),
    }));

    // Add a listener that throws
    counter.subscribe(() => {
      throw new Error('Listener error');
    });

    // Add a normal listener
    let normalListenerCalled = false;
    counter.subscribe(() => {
      normalListenerCalled = true;
    });

    // Trigger an update
    counter.selector.increment();

    // Error should be captured
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe('Listener error');

    // Normal listener should still be called
    expect(normalListenerCalled).toBe(true);
  });

  it('should handle unsubscribe during notification', () => {
    const useStore = defineStore('test', {
      state: () => ({ value: 0 }),
    });

    const store = useStore();
    const createSlice = piniaAdapter(store);

    const state = createSlice(({ get, set }) => ({
      value: () => get().value,
      setValue: (v: number) => set({ value: v }),
    }));

    let unsubscribeB: (() => void) | null = null;
    let callsA = 0;
    let callsB = 0;
    let callsC = 0;

    // Listener A unsubscribes listener B during notification
    state.subscribe(() => {
      callsA++;
      if (unsubscribeB) {
        unsubscribeB();
      }
    });

    // Listener B
    unsubscribeB = state.subscribe(() => {
      callsB++;
    });

    // Listener C
    state.subscribe(() => {
      callsC++;
    });

    // Trigger notification
    state.selector.setValue(1);

    // A and C should be called, B should be called (unsubscribe happens after)
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
});
