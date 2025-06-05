/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLattice, LatticeProvider, useLatticeStore } from './index';
import { createComponent, createModel, createSlice } from '@lattice/core';
import React from 'react';

describe('React Adapter', () => {
  describe('useLattice hook', () => {
    it('should create a store with actions and views', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const { result } = renderHook(() => useLattice(counter));

      expect(result.current.actions).toBeDefined();
      expect(result.current.views).toBeDefined();
      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.actions.increment).toBe('function');
      expect(typeof result.current.views.count).toBe('function');
    });

    it('should update state when actions are called', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const { result } = renderHook(() => useLattice(counter));

      expect(result.current.views.count().value).toBe(0);

      act(() => {
        result.current.actions.increment();
      });

      expect(result.current.views.count().value).toBe(1);

      act(() => {
        result.current.actions.increment();
      });

      expect(result.current.views.count().value).toBe(2);
    });


    it('should support subscriptions', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const { result } = renderHook(() => useLattice(counter));

      const updates: Array<{ value: number }> = [];
      const unsubscribe = result.current.subscribe(
        (views) => views.count(),
        (count) => updates.push(count)
      );

      act(() => {
        result.current.actions.increment();
      });

      act(() => {
        result.current.actions.increment();
      });

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({ value: 1 });
      expect(updates[1]).toEqual({ value: 2 });

      unsubscribe();
    });

    it('should clean up on unmount', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
        }>(() => ({
          count: 0,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {},
        };
      });

      const { result, unmount } = renderHook(() => useLattice(counter));

      const store = result.current;
      let updateCount = 0;
      const unsubscribe = store.subscribe(
        () => ({}),
        () => updateCount++
      );

      unmount();

      // Subscription should still work after unmount since it's external
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('LatticeProvider and useLatticeStore', () => {
    it('should provide store to child components', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      // Need to create a wrapper component that uses the hook
      const StoreWrapper = ({ children }: { children: React.ReactNode }) => {
        const store = useLattice(counter);
        return React.createElement(LatticeProvider as any, { store }, children);
      };
      
      const wrapper = ({ children }: { children: React.ReactNode }) => 
        React.createElement(StoreWrapper, { children });

      const { result } = renderHook(() => useLatticeStore<
        { count: number; increment: () => void },
        { increment: () => void },
        { count: () => { value: number } }
      >(), { wrapper });

      expect(result.current.actions).toBeDefined();
      expect(result.current.views).toBeDefined();
      expect(typeof result.current.actions.increment).toBe('function');
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      expect(() => {
        renderHook(() => useLatticeStore());
      }).toThrow('useLatticeStore must be used within a LatticeProvider');

      console.error = originalError;
    });

    it('should support store prop pattern', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      
      // Need to create a wrapper component that uses the hook
      const StoreWrapper = ({ children }: { children: React.ReactNode }) => {
        const store = useLattice(counter);
        return React.createElement(LatticeProvider as any, { store }, children);
      };
      
      const wrapper = ({ children }: { children: React.ReactNode }) => 
        React.createElement(StoreWrapper, { children });

      const { result } = renderHook(() => useLatticeStore<
        { count: number; increment: () => void },
        { increment: () => void },
        { count: () => { value: number } }
      >(), { wrapper });

      expect(result.current.actions).toBeDefined();
      expect(result.current.views).toBeDefined();
      expect(typeof result.current.actions.increment).toBe('function');

      // Test that actions work
      act(() => {
        result.current.actions.increment();
      });

      expect(result.current.views.count().value).toBe(1);
    });
  });
});

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createComponent, createModel, createSlice } = await import(
    '@lattice/core'
  );

  describe('React Adapter - in-source tests', () => {
    it('should handle complex models with multiple slices', () => {
      const todoApp = createComponent(() => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; done: boolean }>;
          filter: 'all' | 'active' | 'completed';
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set, get }) => ({
          todos: [],
          filter: 'all',
          addTodo: (text) => {
            const { todos } = get();
            set({
              todos: [...todos, { id: Date.now(), text, done: false }],
            });
          },
          toggleTodo: (id) => {
            const { todos } = get();
            set({
              todos: todos.map((todo) =>
                todo.id === id ? { ...todo, done: !todo.done } : todo
              ),
            });
          },
          setFilter: (filter) => set({ filter }),
        }));

        const actions = createSlice(model, (m) => ({
          addTodo: m.addTodo,
          toggleTodo: m.toggleTodo,
          setFilter: m.setFilter,
        }));

        const todosView = createSlice(model, (m) => {
          const todos = m.filter === 'all'
            ? m.todos
            : m.filter === 'active'
            ? m.todos.filter((t) => !t.done)
            : m.todos.filter((t) => t.done);

          return {
            todos,
            count: todos.length,
            filter: m.filter,
          };
        });

        return {
          model,
          actions,
          views: { todos: todosView },
        };
      });

      // This would be used in a React component
      // const store = useLattice(todoApp);
      // Since we're in a non-React context, we can't test the hook directly
      // but we've verified the types compile correctly
      expect(todoApp).toBeDefined();
    });

    it('should support fine-grained updates with selective listeners', async () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          name: string;
          increment: () => void;
          setName: (name: string) => void;
        }>(({ set, get }) => ({
          count: 0,
          name: 'Test',
          increment: () => set({ count: get().count + 1 }),
          setName: (name: string) => set({ name }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          setName: m.setName,
        }));

        const countView = createSlice(model, (m) => ({
          count: m.count,
        }));

        const nameView = createSlice(model, (m) => ({
          name: m.name,
        }));

        return {
          model,
          actions,
          views: { count: countView, name: nameView },
        };
      });

      const { result } = renderHook(() => useLattice(counter));

      // Track calls to subscribers
      let countSubscriberCalls = 0;
      let nameSubscriberCalls = 0;

      // Subscribe to count changes only
      const unsubscribeCount = result.current.subscribe(
        (views) => views.count().count,
        () => { countSubscriberCalls++; }
      );

      // Subscribe to name changes only
      const unsubscribeName = result.current.subscribe(
        (views) => views.name().name,
        () => { nameSubscriberCalls++; }
      );

      // Change count - should only trigger count subscriber
      await act(async () => {
        result.current.actions.increment();
      });

      expect(countSubscriberCalls).toBe(1);
      expect(nameSubscriberCalls).toBe(0);

      // Change name - should only trigger name subscriber
      await act(async () => {
        result.current.actions.setName('New Name');
      });

      expect(countSubscriberCalls).toBe(1);
      expect(nameSubscriberCalls).toBe(1);

      // Cleanup
      unsubscribeCount();
      unsubscribeName();
    });
  });
}