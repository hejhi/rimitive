import { describe, it, expect } from 'vitest';
import { createStore } from './store';

describe('Store', () => {
  it('should create a store with initial state', () => {
    const store = createStore({ count: 0, name: 'test' });

    expect(store.state.count.value).toBe(0);
    expect(store.state.name.value).toBe('test');
  });

  it('should update state with set', () => {
    const store = createStore({ count: 0, name: 'test' });

    store.set({ count: 5 });
    expect(store.state.count.value).toBe(5);
    expect(store.state.name.value).toBe('test'); // unchanged

    store.set({ name: 'updated' });
    expect(store.state.count.value).toBe(5); // unchanged
    expect(store.state.name.value).toBe('updated');
  });

  it('should batch multiple updates', () => {
    const store = createStore({ a: 1, b: 2, c: 3 });
    let updateCount = 0;

    const ctx = store.getContext();
    const unsubscribe = ctx.effect(() => {
      // Access all state to track changes
      void store.state.a.value;
      void store.state.b.value;
      void store.state.c.value;
      updateCount++;
    });

    // Reset after initial run
    updateCount = 0;

    store.set({ a: 10, b: 20, c: 30 });

    expect(updateCount).toBe(1); // Should only trigger once
    expect(store.state.a.value).toBe(10);
    expect(store.state.b.value).toBe(20);
    expect(store.state.c.value).toBe(30);

    unsubscribe();
  });

  it('should work with computed values', () => {
    const store = createStore({ a: 1, b: 2 });
    const ctx = store.getContext();

    const sum = ctx.computed(() => store.state.a.value + store.state.b.value);

    expect(sum.value).toBe(3);

    store.set({ a: 10 });
    expect(sum.value).toBe(12);

    store.set({ a: 5, b: 5 });
    expect(sum.value).toBe(10);
  });

  it('should support update functions', () => {
    const store = createStore({ count: 0 });

    store.set((current) => ({ count: current.count + 1 }));
    expect(store.state.count.value).toBe(1);

    store.set((current) => ({ count: current.count * 2 }));
    expect(store.state.count.value).toBe(2);
  });

  it('should provide convenience methods for computed and subscribe', () => {
    const store = createStore({ count: 0, name: 'test' });

    // Test computed
    const doubled = store.computed(() => store.state.count.value * 2);
    expect(doubled.value).toBe(0);

    store.set({ count: 5 });
    expect(doubled.value).toBe(10);

    // Test subscribe
    let subscribeCount = 0;
    const cleanup = store.subscribe(() => {
      void store.state.count.value;
      subscribeCount++;
    });

    expect(subscribeCount).toBe(1); // Runs immediately

    store.set({ count: 10 });
    expect(subscribeCount).toBe(2); // Runs on change

    cleanup();
  });

  describe('computed values', () => {
    it('should create computed values with store.computed', () => {
      const store = createStore({ count: 0, name: 'test' });

      // Single value selector
      const count = store.computed(() => store.state.count.value);
      expect(count.value).toBe(0);

      // Computed derived value
      const doubled = store.computed(() => store.state.count.value * 2);
      expect(doubled.value).toBe(0);

      store.set({ count: 5 });
      expect(count.value).toBe(5);
      expect(doubled.value).toBe(10);
    });

    it('should work with object computed values', () => {
      const store = createStore({ user: { name: 'John', age: 30 }, count: 0 });

      // Select multiple values
      const selection = store.computed(() => ({
        userName: store.state.user.value.name,
        userAge: store.state.user.value.age,
        count: store.state.count.value,
      }));

      expect(selection.value).toEqual({
        userName: 'John',
        userAge: 30,
        count: 0,
      });

      store.set({ user: { name: 'Jane', age: 25 } });
      expect(selection.value).toEqual({
        userName: 'Jane',
        userAge: 25,
        count: 0,
      });
    });

    it('should work with complex derived state', () => {
      interface Todo {
        id: number;
        text: string;
        done: boolean;
      }

      const store = createStore({
        todos: [
          { id: 1, text: 'Task 1', done: false },
          { id: 2, text: 'Task 2', done: true },
          { id: 3, text: 'Task 3', done: false },
        ] as Todo[],
      });

      const stats = store.computed(() => {
        const todos = store.state.todos.value;
        return {
          total: todos.length,
          completed: todos.filter((t) => t.done).length,
          active: todos.filter((t) => !t.done).length,
          percentComplete:
            todos.length > 0
              ? Math.round(
                  (todos.filter((t) => t.done).length / todos.length) * 100
                )
              : 0,
        };
      });

      expect(stats.value).toEqual({
        total: 3,
        completed: 1,
        active: 2,
        percentComplete: 33,
      });

      // Mark another task as done
      store.set({
        todos: store.state.todos.value.map((t) =>
          t.id === 3 ? { ...t, done: true } : t
        ),
      });

      expect(stats.value).toEqual({
        total: 3,
        completed: 2,
        active: 1,
        percentComplete: 67,
      });
    });
  });
});
