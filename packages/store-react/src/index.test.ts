/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  useStore,
  useStoreSelector,
  useStoreSubscribe,
  createStoreContext,
  createStoreProvider,
  shallowEqual,
  StoreApi,
} from './index';

describe('store-react', () => {
  describe('useStore', () => {
    it('should create a store with initial state', () => {
      const { result } = renderHook(() =>
        useStore(() => ({
          count: 0,
          name: 'test',
        }))
      );

      expect(result.current.count).toBe(0);
      expect(result.current.name).toBe('test');
      expect(typeof result.current.getState).toBe('function');
      expect(typeof result.current.setState).toBe('function');
      expect(typeof result.current.subscribe).toBe('function');
    });

    it('should update state with setState', () => {
      interface CounterStore {
        count: number;
        increment: () => void;
      }

      const { result } = renderHook(() =>
        useStore<CounterStore>((set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }))
      );

      expect(result.current.count).toBe(0);

      act(() => {
        result.current.increment();
      });

      expect(result.current.count).toBe(1);

      act(() => {
        result.current.setState({ count: 10 });
      });

      expect(result.current.count).toBe(10);
    });

    it('should not re-render if state does not change', () => {
      let renderCount = 0;

      interface CountStore {
        count: number;
        setCount: (count: number) => void;
      }

      const { result } = renderHook(() => {
        renderCount++;
        return useStore<CountStore>((set) => ({
          count: 0,
          setCount: (count: number) => set({ count }),
        }));
      });

      const initialRenderCount = renderCount;

      act(() => {
        result.current.setCount(0); // Same value
      });

      expect(renderCount).toBe(initialRenderCount);

      act(() => {
        result.current.setCount(1); // Different value
      });

      expect(renderCount).toBe(initialRenderCount + 1);
    });

    it('should support complex state updates', () => {
      interface Todo {
        id: number;
        text: string;
        done: boolean;
      }

      interface TodoStore {
        todos: Todo[];
        filter: 'all' | 'active' | 'completed';
        addTodo: (text: string) => void;
        toggleTodo: (id: number) => void;
        setFilter: (filter: 'all' | 'active' | 'completed') => void;
      }

      const { result } = renderHook(() =>
        useStore<TodoStore>((set, get) => ({
          todos: [] as Todo[],
          filter: 'all' as 'all' | 'active' | 'completed',
          addTodo: (text: string) => {
            const todo: Todo = { id: Date.now(), text, done: false };
            set({ todos: [...get().todos, todo] });
          },
          toggleTodo: (id: number) => {
            set({
              todos: get().todos.map((t: Todo) =>
                t.id === id ? { ...t, done: !t.done } : t
              ),
            });
          },
          setFilter: (filter: 'all' | 'active' | 'completed') =>
            set({ filter }),
        }))
      );

      expect(result.current.todos).toHaveLength(0);

      act(() => {
        result.current.addTodo('Test todo');
      });

      expect(result.current.todos).toHaveLength(1);
      expect(result.current.todos[0]?.text).toBe('Test todo');
      expect(result.current.todos[0]?.done).toBe(false);

      const todoId = result.current.todos[0]?.id ?? 0;

      act(() => {
        result.current.toggleTodo(todoId);
      });

      expect(result.current.todos[0]?.done).toBe(true);

      act(() => {
        result.current.setFilter('completed');
      });

      expect(result.current.filter).toBe('completed');
    });

    it('should cleanup on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useStore(() => ({
          count: 0,
        }))
      );

      const store = result.current;
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      unmount();

      // Should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('useStoreSelector', () => {
    it('should select values from store', () => {
      interface TestStore {
        count: number;
        name: string;
        increment: () => void;
        setName: (name: string) => void;
      }

      const { result: storeResult } = renderHook(() =>
        useStore<TestStore>((set, get) => ({
          count: 0,
          name: 'test',
          increment: () => set({ count: get().count + 1 }),
          setName: (name: string) => set({ name }),
        }))
      );

      const { result: countResult } = renderHook(() =>
        useStoreSelector(storeResult.current, (s) => s.count)
      );

      const { result: nameResult } = renderHook(() =>
        useStoreSelector(storeResult.current, (s) => s.name)
      );

      expect(countResult.current).toBe(0);
      expect(nameResult.current).toBe('test');

      act(() => {
        storeResult.current.increment();
      });

      expect(countResult.current).toBe(1);
      expect(nameResult.current).toBe('test');

      act(() => {
        storeResult.current.setName('new name');
      });

      expect(countResult.current).toBe(1);
      expect(nameResult.current).toBe('new name');
    });

    it('should only re-render when selected value changes', () => {
      interface TestStore {
        count: number;
        name: string;
        increment: () => void;
        setName: (name: string) => void;
      }

      const { result: storeResult } = renderHook(() =>
        useStore<TestStore>((set, get) => ({
          count: 0,
          name: 'test',
          increment: () => set({ count: get().count + 1 }),
          setName: (name: string) => set({ name }),
        }))
      );

      let countRenders = 0;
      renderHook(() => {
        countRenders++;
        return useStoreSelector(storeResult.current, (s) => s.count);
      });

      const initialCountRenders = countRenders;

      act(() => {
        storeResult.current.setName('new name'); // Should not trigger re-render
      });

      expect(countRenders).toBe(initialCountRenders);

      act(() => {
        storeResult.current.increment(); // Should trigger re-render
      });

      expect(countRenders).toBe(initialCountRenders + 1);
    });

    it('should use custom equality function', () => {
      interface User {
        id: number;
        name: string;
      }

      interface UserStore {
        user: User;
        setUser: (user: User) => void;
      }

      const { result: storeResult } = renderHook(() =>
        useStore<UserStore>((set) => ({
          user: { id: 1, name: 'test' },
          setUser: (user: User) => set({ user }),
        }))
      );

      let renders = 0;
      renderHook(() => {
        renders++;
        return useStoreSelector(
          storeResult.current,
          (s) => s.user,
          shallowEqual
        );
      });

      const initialRenders = renders;

      act(() => {
        // Same values, should not re-render with shallow equality
        storeResult.current.setUser({ id: 1, name: 'test' });
      });

      expect(renders).toBe(initialRenders);

      act(() => {
        // Different values, should re-render
        storeResult.current.setUser({ id: 2, name: 'test' });
      });

      expect(renders).toBe(initialRenders + 1);
    });

    it('should support computed selectors', () => {
      interface ComputedStore {
        count: number;
        multiplier: number;
        increment: () => void;
        setMultiplier: (m: number) => void;
      }

      const { result: storeResult } = renderHook(() =>
        useStore<ComputedStore>((set, get) => ({
          count: 0,
          multiplier: 2,
          increment: () => set({ count: get().count + 1 }),
          setMultiplier: (m: number) => set({ multiplier: m }),
        }))
      );

      const { result: computedResult } = renderHook(() =>
        useStoreSelector(storeResult.current, (s) => s.count * s.multiplier)
      );

      expect(computedResult.current).toBe(0);

      act(() => {
        storeResult.current.increment();
      });

      expect(computedResult.current).toBe(2);

      act(() => {
        storeResult.current.setMultiplier(3);
      });

      expect(computedResult.current).toBe(3);
    });
  });

  describe('useStoreSubscribe', () => {
    it('should call callback on store changes', () => {
      interface CounterStore {
        count: number;
        increment: () => void;
      }

      const { result: storeResult } = renderHook(() =>
        useStore<CounterStore>((set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }))
      );

      const callback = vi.fn();

      renderHook(() => useStoreSubscribe(storeResult.current, callback));

      // Should be called immediately
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ count: 0 })
      );

      act(() => {
        storeResult.current.increment();
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({ count: 1 })
      );
    });

    it('should cleanup on unmount', () => {
      interface CounterStore {
        count: number;
        increment: () => void;
      }

      const { result: storeResult } = renderHook(() =>
        useStore<CounterStore>((set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }))
      );

      const callback = vi.fn();

      const { unmount } = renderHook(() =>
        useStoreSubscribe(storeResult.current, callback)
      );

      callback.mockClear();

      unmount();

      act(() => {
        storeResult.current.increment();
      });

      // Should not be called after unmount
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('createStoreContext', () => {
    it('should provide store to children', () => {
      interface CounterStore {
        count: number;
        increment: () => void;
      }

      const CounterContext = createStoreContext<CounterStore>();

      let childStore: CounterStore | null = null;

      function Child() {
        childStore = CounterContext.useStore();
        return null;
      }

      function Parent() {
        const store = useStore<CounterStore>((set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        return React.createElement(
          CounterContext.Provider,
          { value: store },
          React.createElement(Child)
        );
      }

      // Render the component tree
      renderHook(() => null, {
        wrapper: Parent,
      });

      expect(childStore).not.toBeNull();
      expect(childStore!.count).toBe(0);

      act(() => {
        childStore!.increment();
      });

      expect(childStore!.count).toBe(1);
    });

    it('should throw when used outside provider', () => {
      const Context = createStoreContext();

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      expect(() => {
        renderHook(() => Context.useStore());
      }).toThrow('useStore must be used within a Provider');

      console.error = originalError;
    });
  });

  describe('createStoreProvider', () => {
    it('should create provider and hook', () => {
      interface ComponentStore {
        user: string | null;
        login: (user: string) => void;
        logout: () => void;
      }

      const { StoreProvider, useStore: useComponentStore } =
        createStoreProvider<ComponentStore>();

      let profileStore: ComponentStore | null = null;

      function UserProfile() {
        profileStore = useComponentStore();
        return null;
      }

      function Component() {
        const store = useStore<ComponentStore>((set) => ({
          user: null as string | null,
          login: (user: string) => set({ user }),
          logout: () => set({ user: null }),
        }));

        return React.createElement(StoreProvider, {
          store,
          children: React.createElement(UserProfile),
        });
      }

      // Render the component tree
      renderHook(() => null, {
        wrapper: Component,
      });

      expect(profileStore).not.toBeNull();
      expect(profileStore!.user).toBeNull();

      act(() => {
        profileStore!.login('test-user');
      });

      expect(profileStore!.user).toBe('test-user');

      act(() => {
        profileStore!.logout();
      });

      expect(profileStore!.user).toBeNull();
    });
  });

  describe('shallowEqual', () => {
    it('should return true for identical values', () => {
      const obj = { a: 1 };
      expect(shallowEqual(obj, obj)).toBe(true);
      expect(shallowEqual(1, 1)).toBe(true);
      expect(shallowEqual('test', 'test')).toBe(true);
      expect(shallowEqual(null, null)).toBe(true);
      expect(shallowEqual(undefined, undefined)).toBe(true);
    });

    it('should return true for shallow equal objects', () => {
      expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(shallowEqual({}, {})).toBe(true);
    });

    it('should return false for different values', () => {
      expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
      expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(shallowEqual(1, 2)).toBe(false);
      expect(shallowEqual('a', 'b')).toBe(false);
      expect(shallowEqual(null, undefined)).toBe(false);
      expect(shallowEqual({}, null)).toBe(false);
    });

    it('should return false for deep changes', () => {
      expect(shallowEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(false); // Different object references
    });
  });

  describe('Performance', () => {
    it('should maintain stable API references across renders', () => {
      const apiRefs: StoreApi<{ count: number }>[] = [];

      const { rerender } = renderHook(() => {
        const store = useStore(() => ({ count: 0 }));
        apiRefs.push({
          getState: store.getState,
          setState: store.setState,
          subscribe: store.subscribe,
          destroy: store.destroy,
        });
        return store;
      });

      // Force multiple re-renders
      rerender();
      rerender();
      rerender();

      // All API references should be the same
      expect(apiRefs.length).toBe(4);
      for (let i = 1; i < apiRefs.length; i++) {
        expect(apiRefs[i]!.getState).toBe(apiRefs[0]!.getState);
        expect(apiRefs[i]!.setState).toBe(apiRefs[0]!.setState);
        expect(apiRefs[i]!.subscribe).toBe(apiRefs[0]!.subscribe);
        expect(apiRefs[i]!.destroy).toBe(apiRefs[0]!.destroy);
      }
    });

    it('should not create new result objects when state has not changed', () => {
      const results: any[] = [];

      const { result, rerender } = renderHook(() => {
        const store = useStore(() => ({ count: 0, name: 'test' }));
        results.push(store);
        return store;
      });

      // Force re-renders without state changes
      rerender();
      rerender();

      // All results should be the same object reference
      expect(results.length).toBe(3);
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);

      // Change state
      act(() => {
        result.current.setState({ count: 1 });
      });

      // New object should be created after state change
      expect(results.length).toBe(4);
      expect(results[3]).not.toBe(results[0]);
      expect(results[3]!.count).toBe(1);
    });

    it('should handle rapid state updates efficiently', () => {
      const { result } = renderHook(() =>
        useStore<{ count: number; increment: () => void }>((set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }))
      );

      const startTime = performance.now();

      // Perform 1000 increments
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.increment();
        }
      });

      const endTime = performance.now();

      expect(result.current.count).toBe(1000);
      // Should complete in under 50ms (typically ~5-10ms)
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should efficiently handle many subscribers', () => {
      const { result } = renderHook(() => useStore(() => ({ count: 0 })));

      const callbacks: (() => void)[] = [];
      const unsubscribes: (() => void)[] = [];

      // Add 100 subscribers
      for (let i = 0; i < 100; i++) {
        const callback = vi.fn();
        callbacks.push(callback);
        unsubscribes.push(result.current.subscribe(callback));
      }

      // Update state
      act(() => {
        result.current.setState({ count: 1 });
      });

      // All callbacks should be called once
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });

      // Clean up
      unsubscribes.forEach((unsub) => unsub());
    });
  });
});
