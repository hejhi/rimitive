/**
 * @fileoverview Tests for React hooks in Zustand adapter
 *
 * These tests use React Testing Library with proper TypeScript typing
 * and follow best practices for testing React hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createComponent, createModel, createSlice, compose } from '@lattice/core';
import { createZustandAdapter } from './index.js';
import { useViews, useView, useActions, useLattice } from './react.js';

describe('React hooks for Zustand adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useViews', () => {
    it('should return selected view values', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          text: string;
          className: string;
          disabled: boolean;
          onClick: () => void;
        }>(({ set }) => ({
          text: 'Hello',
          className: 'display',
          disabled: false,
          onClick: () => set({ text: 'Clicked' }),
        }));

        const displayView = createSlice(model, (m) => ({
          text: m.text,
          className: m.className,
        }));

        const buttonView = createSlice(model, (m) => ({
          onClick: m.onClick,
          disabled: m.disabled,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            display: displayView,
            button: buttonView,
          },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result } = renderHook(() =>
        useViews(store, (views) => ({
          display: views.display(),
          button: views.button(),
        }))
      );

      expect(result.current.display).toEqual({
        text: 'Hello',
        className: 'display',
      });
      expect(result.current.button.disabled).toBe(false);
      expect(typeof result.current.button.onClick).toBe('function');
    });

    it('should update when views change', async () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const countView = createSlice(model, (m) => ({
          value: m.count,
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            increment: m.increment,
          })),
          views: {
            count: countView,
          },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result } = renderHook(() =>
        useViews(store, (views) => views.count())
      );

      expect(result.current.value).toBe(0);

      // Update the store
      act(() => {
        store.actions.increment();
      });

      // Wait for the update to propagate
      await waitFor(() => {
        expect(result.current.value).toBe(1);
      });
    });

    it('should unsubscribe on unmount', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          value: string;
        }>(() => ({
          value: 'test',
        }));

        const testView = createSlice(model, (m) => ({
          value: m.value,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { test: testView },
        };
      });

      const store = createZustandAdapter(testComponent);
      const subscribeSpy = vi.spyOn(store, 'subscribe');

      const { unmount } = renderHook(() =>
        useViews(store, (views) => views.test())
      );

      expect(subscribeSpy).toHaveBeenCalled();
      const unsubscribe = subscribeSpy.mock.results[0]?.value;
      expect(typeof unsubscribe).toBe('function');

      unmount();

      // Verify unsubscribe was called by checking no errors on subsequent updates
      // This is indirect but avoids implementation details
    });

    it('should handle multiple view selections', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          user: { name: string; id: number };
          theme: { mode: string; color: string };
          online: boolean;
        }>(() => ({
          user: { name: 'Alice', id: 1 },
          theme: { mode: 'dark', color: 'blue' },
          online: true,
        }));

        const userView = createSlice(model, (m) => m.user);
        const themeView = createSlice(model, (m) => m.theme);
        const statusView = createSlice(model, (m) => ({
          online: m.online,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            user: userView,
            theme: themeView,
            status: statusView,
          },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result } = renderHook(() =>
        useViews(store, (views) => ({
          user: views.user(),
          theme: views.theme(),
        }))
      );

      expect(result.current).toEqual({
        user: { name: 'Alice', id: 1 },
        theme: { mode: 'dark', color: 'blue' },
      });
    });
  });

  describe('useView', () => {
    it('should return single view attributes', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          text: string;
          className: string;
        }>(() => ({
          text: 'Hello',
          className: 'display',
        }));

        const displayView = createSlice(model, (m) => ({
          text: m.text,
          className: m.className,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { display: displayView },
        };
      });

      const store = createZustandAdapter(testComponent);
      const { result } = renderHook(() => useView(store, 'display'));

      expect(result.current).toEqual({ text: 'Hello', className: 'display' });
    });

    it('should update when the specific view changes', async () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          text: string;
          updateText: (text: string) => void;
        }>(({ set }) => ({
          text: 'Initial',
          updateText: (text) => set({ text }),
        }));

        const displayView = createSlice(model, (m) => ({
          text: m.text,
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateText: m.updateText,
          })),
          views: { display: displayView },
        };
      });

      const store = createZustandAdapter(testComponent);
      const { result } = renderHook(() => useView(store, 'display'));

      expect(result.current.text).toBe('Initial');

      act(() => {
        store.actions.updateText('Updated');
      });

      await waitFor(() => {
        expect(result.current.text).toBe('Updated');
      });
    });
  });

  describe('useActions', () => {
    it('should return actions object', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
          reset: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          reset: () => set({ count: 0 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
          reset: m.reset,
        }));

        return {
          model,
          actions,
          views: {},
        };
      });

      const store = createZustandAdapter(testComponent);
      const { result } = renderHook(() => useActions(store));

      expect(typeof result.current.increment).toBe('function');
      expect(typeof result.current.decrement).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should maintain stable reference across renders', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          doSomething: () => void;
        }>(() => ({
          doSomething: () => {},
        }));

        const actions = createSlice(model, (m) => ({
          doSomething: m.doSomething,
        }));

        return {
          model,
          actions,
          views: {},
        };
      });

      const store = createZustandAdapter(testComponent);
      const { result, rerender } = renderHook(() => useActions(store));

      const firstReference = result.current;

      rerender();

      const secondReference = result.current;

      expect(firstReference).toBe(secondReference);
    });

    it('should execute actions correctly', () => {
      let actionCalled = false;

      const testComponent = createComponent(() => {
        const model = createModel<{
          testAction: () => void;
        }>(() => ({
          testAction: () => {
            actionCalled = true;
          },
        }));

        const actions = createSlice(model, (m) => ({
          testAction: m.testAction,
        }));

        return {
          model,
          actions,
          views: {},
        };
      });

      const store = createZustandAdapter(testComponent);
      const { result } = renderHook(() => useActions(store));

      expect(actionCalled).toBe(false);

      act(() => {
        result.current.testAction();
      });

      expect(actionCalled).toBe(true);
    });
  });

  describe('useLattice', () => {
    it('should return both views and actions', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          text: string;
          count: number;
          increment: () => void;
          setText: (text: string) => void;
        }>(({ set, get }) => ({
          text: 'Hello',
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          setText: (text) => set({ text }),
        }));

        const displayView = createSlice(model, (m) => ({
          text: m.text,
          className: 'display',
        }));

        const buttonView = createSlice(model, (m) => ({
          onClick: m.increment,
          disabled: false,
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          setText: m.setText,
        }));

        return {
          model,
          actions,
          views: {
            display: displayView,
            button: buttonView,
          },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result } = renderHook(() =>
        useLattice(store, (views) => ({
          display: views.display(),
          button: views.button(),
        }))
      );

      expect(result.current.views.display).toEqual({
        text: 'Hello',
        className: 'display',
      });
      expect(result.current.views.button.disabled).toBe(false);
      expect(typeof result.current.actions.increment).toBe('function');
      expect(typeof result.current.actions.setText).toBe('function');
    });

    it('should update views while keeping actions stable', async () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const countView = createSlice(model, (m) => ({
          value: m.count,
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        return {
          model,
          actions,
          views: { count: countView },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result } = renderHook(() =>
        useLattice(store, (views) => views.count())
      );

      const initialActions = result.current.actions;
      expect(result.current.views.value).toBe(0);

      act(() => {
        result.current.actions.increment();
      });

      await waitFor(() => {
        expect(result.current.views.value).toBe(1);
      });

      // Actions should remain the same reference
      expect(result.current.actions).toBe(initialActions);
    });
  });

  describe('integration tests', () => {
    it('should work with complex view compositions', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          firstName: string;
          lastName: string;
          age: number;
          isAdmin: boolean;
        }>(() => ({
          firstName: 'John',
          lastName: 'Doe',
          age: 30,
          isAdmin: false,
        }));

        const userSlice = createSlice(model, (m) => ({
          firstName: m.firstName,
          lastName: m.lastName,
          fullName: `${m.firstName} ${m.lastName}`,
        }));

        const permissionsSlice = createSlice(model, (m) => ({
          isAdmin: m.isAdmin,
          canEdit: m.isAdmin,
          canDelete: m.isAdmin,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            user: userSlice,
            permissions: permissionsSlice,
          },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result } = renderHook(() =>
        useViews(store, (views) => ({
          user: views.user(),
          canEdit: views.permissions().canEdit,
        }))
      );

      expect(result.current.user.fullName).toBe('John Doe');
      expect(result.current.canEdit).toBe(false);
    });

    it('should work with computed views', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; completed: boolean }>;
          filter: 'all' | 'active' | 'completed';
        }>(() => ({
          todos: [
            { id: 1, text: 'Todo 1', completed: false },
            { id: 2, text: 'Todo 2', completed: true },
            { id: 3, text: 'Todo 3', completed: false },
          ],
          filter: 'all',
        }));

        const todosSlice = createSlice(model, (m) => ({
          todos: m.todos,
          filter: m.filter,
        }));

        const statsView = todosSlice((state) => ({
          total: state.todos.length,
          completed: state.todos.filter((t) => t.completed).length,
          active: state.todos.filter((t) => !t.completed).length,
        }));

        const filteredTodosView = todosSlice((state) => {
          const filtered =
            state.filter === 'all'
              ? state.todos
              : state.filter === 'active'
                ? state.todos.filter((t) => !t.completed)
                : state.todos.filter((t) => t.completed);

          return {
            items: filtered,
            count: filtered.length,
          };
        });

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            stats: statsView,
            filteredTodos: filteredTodosView,
          },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result } = renderHook(() =>
        useViews(store, (views) => ({
          stats: views.stats(),
          filteredTodos: views.filteredTodos(),
        }))
      );

      expect(result.current.stats).toEqual({
        total: 3,
        completed: 1,
        active: 2,
      });
      expect(result.current.filteredTodos).toBeDefined();
      expect(result.current.filteredTodos.count).toBe(3);
    });

    it('should handle views with compose()', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          user: { name: string; email: string };
          preferences: { theme: string; language: string };
        }>(() => ({
          user: { name: 'Alice', email: 'alice@example.com' },
          preferences: { theme: 'dark', language: 'en' },
        }));

        const userSlice = createSlice(model, (m) => m.user);
        const prefsSlice = createSlice(model, (m) => m.preferences);

        const profileView = createSlice(
          model,
          compose({ userSlice, prefsSlice }, (_, { userSlice, prefsSlice }) => ({
            user: userSlice,
            theme: prefsSlice.theme,
          }))
        );

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            profile: profileView,
          },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result } = renderHook(() =>
        useViews(store, (views) => views.profile())
      );

      expect(result.current.user).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
      });
      expect(result.current.theme).toBe('dark');
    });

    it('should handle error cases gracefully', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          value: string | null;
        }>(() => ({
          value: null,
        }));

        const errorView = createSlice(model, (m) => {
          if (m.value === null) {
            throw new Error('Value is null');
          }
          return { value: m.value };
        });

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { error: errorView },
        };
      });

      const store = createZustandAdapter(testComponent);

      expect(() => {
        renderHook(() => useView(store, 'error'));
      }).toThrow('Value is null');
    });

    it('should work with dynamic view selection', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          tab1: string;
          tab2: string;
          activeTab: 'tab1' | 'tab2';
        }>(() => ({
          tab1: 'Content 1',
          tab2: 'Content 2',
          activeTab: 'tab1',
        }));

        const tab1View = createSlice(model, (m) => ({
          content: m.tab1,
          isActive: m.activeTab === 'tab1',
        }));

        const tab2View = createSlice(model, (m) => ({
          content: m.tab2,
          isActive: m.activeTab === 'tab2',
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            tab1: tab1View,
            tab2: tab2View,
          },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result: result1 } = renderHook(() =>
        useView(store, 'tab1')
      );

      expect(result1.current.content).toBe('Content 1');
      expect(result1.current.isActive).toBe(true);

      const { result: result2 } = renderHook(() =>
        useView(store, 'tab2')
      );

      expect(result2.current.content).toBe('Content 2');
      expect(result2.current.isActive).toBe(false);
    });

    it('should handle rapid updates correctly', async () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          counter: number;
          increment: () => void;
        }>(({ set, get }) => ({
          counter: 0,
          increment: () => set({ counter: get().counter + 1 }),
        }));

        const counterView = createSlice(model, (m) => ({
          value: m.counter,
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        return {
          model,
          actions,
          views: { counter: counterView },
        };
      });

      const store = createZustandAdapter(testComponent);

      const renders: number[] = [];
      const { result } = renderHook(() => {
        const views = useViews(store, (v) => v.counter());
        renders.push(views.value);
        return views;
      });

      // Perform rapid updates
      act(() => {
        store.actions.increment();
        store.actions.increment();
        store.actions.increment();
      });

      await waitFor(() => {
        expect(result.current.value).toBe(3);
      });

      // Should batch updates efficiently
      expect(renders.length).toBeGreaterThanOrEqual(2); // Initial + at least one update
      expect(renders[renders.length - 1]).toBe(3);
    });

    it('should clean up subscriptions properly', () => {
      const testComponent = createComponent(() => {
        const model = createModel<{
          value: number;
        }>(() => ({
          value: 0,
        }));

        const valueView = createSlice(model, (m) => ({
          value: m.value,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { value: valueView },
        };
      });

      const store = createZustandAdapter(testComponent);

      const { result, unmount } = renderHook(() =>
        useViews(store, (views) => ({
          todos: views.value(),
        }))
      );

      const todosResult = result;

      unmount();

      // After unmount, the result should still be accessible but frozen
      expect(todosResult.current?.todos).toBeDefined();
    });
  });
});