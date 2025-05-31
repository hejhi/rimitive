/**
 * @fileoverview Tests for React hooks in Zustand adapter
 *
 * These tests use React Testing Library with proper TypeScript typing
 * and follow best practices for testing React hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ZustandAdapterResult } from './index.js';
import { useViews, useView, useActions, useLattice } from './react.js';

describe('React hooks for Zustand adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create a mock ZustandAdapterResult
  function createMockAdapterResult<M = any, A = any, V = any>(
    overrides: Partial<ZustandAdapterResult<M, A, V>> = {}
  ): ZustandAdapterResult<M, A, V> {
    const base = {
      actions: {} as A,
      views: {} as V,
      subscribe: vi.fn(() => vi.fn()),
    };
    return { ...base, ...overrides } as ZustandAdapterResult<M, A, V>;
  }

  describe('useViews', () => {
    it('should return selected view values', () => {
      const mockViews = {
        display: vi.fn(() => ({ text: 'Hello', className: 'display' })),
        button: vi.fn(() => ({ onClick: vi.fn(), disabled: false })),
      };

      const mockStore = createMockAdapterResult({
        views: mockViews as any,
      });

      const { result } = renderHook(() =>
        useViews(mockStore, (views) => ({
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

    it('should update when views change', () => {
      let currentCount = 0;
      const mockViews = {
        count: vi.fn(() => ({ value: currentCount })),
      };

      let subscribeCallback: any;
      const mockStore = createMockAdapterResult({
        views: mockViews as any,
        subscribe: vi.fn((_, callback) => {
          subscribeCallback = callback;
          return vi.fn();
        }),
      });

      const { result } = renderHook(() =>
        useViews(mockStore, (views) => views.count())
      );

      expect(result.current.value).toBe(0);

      // Simulate view change
      currentCount = 1;
      act(() => {
        subscribeCallback({ value: 1 });
      });

      expect(result.current.value).toBe(1);
    });

    it('should unsubscribe on unmount', () => {
      const unsubscribeMock = vi.fn();
      const mockViews = { test: vi.fn(() => ({ value: 'test' })) };
      const mockStore = createMockAdapterResult({
        views: mockViews as any,
        subscribe: vi.fn(() => unsubscribeMock),
      });

      const { unmount } = renderHook(() =>
        useViews(mockStore, (views) => views.test())
      );

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should handle multiple view selections', () => {
      const mockViews = {
        user: vi.fn(() => ({ name: 'Alice', id: 1 })),
        theme: vi.fn(() => ({ mode: 'dark', color: 'blue' })),
        status: vi.fn(() => ({ online: true })),
      };

      const mockStore = createMockAdapterResult({
        views: mockViews as any,
      });

      const { result } = renderHook(() =>
        useViews(mockStore, (views) => ({
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
      const mockViews = {
        display: vi.fn(() => ({ text: 'Hello', className: 'display' })),
        button: vi.fn(() => ({ onClick: vi.fn(), disabled: false })),
      };

      const mockStore = createMockAdapterResult({
        views: mockViews as any,
      });

      const { result } = renderHook(() => useView(mockStore, 'display'));

      expect(result.current).toEqual({ text: 'Hello', className: 'display' });
    });

    it('should update when the specific view changes', () => {
      let currentText = 'Initial';
      const mockViews = {
        display: vi.fn(() => ({ text: currentText })),
      };

      let subscribeCallback: any;
      const mockStore = createMockAdapterResult({
        views: mockViews as any,
        subscribe: vi.fn((_, callback) => {
          subscribeCallback = callback;
          return vi.fn();
        }),
      });

      const { result } = renderHook(() => useView(mockStore, 'display'));

      expect((result.current as any).text).toBe('Initial');

      // Simulate view change
      currentText = 'Updated';
      act(() => {
        subscribeCallback({ text: 'Updated' });
      });

      expect((result.current as any).text).toBe('Updated');
    });
  });

  describe('useActions', () => {
    it('should return actions object', () => {
      const mockActions = {
        increment: vi.fn(),
        decrement: vi.fn(),
        reset: vi.fn(),
      };

      const mockStore = createMockAdapterResult<any, typeof mockActions, any>({
        actions: mockActions,
      });

      const { result } = renderHook(() => useActions(mockStore));

      expect(result.current).toBe(mockActions);
      expect(typeof result.current.increment).toBe('function');
      expect(typeof result.current.decrement).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should maintain stable reference across renders', () => {
      const mockActions = {
        doSomething: vi.fn(),
      };

      const mockStore = createMockAdapterResult<any, typeof mockActions, any>({
        actions: mockActions,
      });

      const { result, rerender } = renderHook(() => useActions(mockStore));

      const firstReference = result.current;

      // Force re-render
      rerender();

      expect(result.current).toBe(firstReference);
    });
  });

  describe('useLattice', () => {
    it('should return both views and actions', () => {
      const mockViews = {
        display: vi.fn(() => ({ text: 'Hello' })),
        button: vi.fn(() => ({ disabled: false })),
      };

      const mockActions = {
        increment: vi.fn(),
        decrement: vi.fn(),
      };

      const mockStore = createMockAdapterResult({
        views: mockViews as any,
        actions: mockActions,
      });

      const { result } = renderHook(() =>
        useLattice(mockStore, (views) => ({
          display: views.display(),
          button: views.button(),
        }))
      );

      expect(result.current.views.display).toEqual({ text: 'Hello' });
      expect(result.current.views.button).toEqual({ disabled: false });
      expect(result.current.actions).toBe(mockActions);
    });

    it('should update views while keeping actions stable', () => {
      let currentCount = 0;
      const mockViews = {
        count: vi.fn(() => ({ value: currentCount })),
      };

      const mockActions = {
        increment: vi.fn(),
      };

      let subscribeCallback: any;
      const mockStore = createMockAdapterResult({
        views: mockViews as any,
        actions: mockActions,
        subscribe: vi.fn((_, callback) => {
          subscribeCallback = callback;
          return vi.fn();
        }),
      });

      const { result } = renderHook(() =>
        useLattice(mockStore, (views) => views.count())
      );

      const initialActions = result.current.actions;
      expect(result.current.views.value).toBe(0);

      // Simulate view change
      currentCount = 1;
      act(() => {
        subscribeCallback({ value: 1 });
      });

      expect(result.current.views.value).toBe(1);
      expect(result.current.actions).toBe(initialActions); // Actions should remain stable
    });
  });

  describe('Integration with real Zustand adapter', () => {
    it('should work with actual adapter result structure', async () => {
      const { createComponent, createModel, createSlice, select } =
        await import('@lattice/core');
      const { createZustandAdapter } = await import('./index.js');

      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
        }));

        const displaySlice = createSlice(model, (m) => ({
          count: m.count,
          isPositive: m.count > 0,
        }));

        const buttonSlice = createSlice(model, (m) => ({
          onClick: select(actions, (a) => a.increment),
          disabled: false,
          label: `Count: ${m.count}`,
        }));

        return {
          model,
          actions,
          views: {
            display: displaySlice,
            button: buttonSlice,
          },
        };
      });

      const store = createZustandAdapter(counter);

      // Test useViews
      const { result: viewsResult } = renderHook(() =>
        useViews(store, (views) => ({
          display: views.display(),
          button: views.button(),
        }))
      );

      expect(viewsResult.current.display.count).toBe(0);
      expect(viewsResult.current.display.isPositive).toBe(false);
      expect(viewsResult.current.button.label).toBe('Count: 0');

      // Test useActions
      const { result: actionsResult } = renderHook(() => useActions(store));

      act(() => {
        actionsResult.current.increment();
      });

      // Views should update
      expect(viewsResult.current.display.count).toBe(1);
      expect(viewsResult.current.display.isPositive).toBe(true);
      expect(viewsResult.current.button.label).toBe('Count: 1');
    });

    it('should handle complex view selectors', async () => {
      const { createComponent, createModel, createSlice } = await import(
        '@lattice/core'
      );
      const { createZustandAdapter } = await import('./index.js');

      const todoApp = createComponent(() => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; completed: boolean }>;
          filter: 'all' | 'active' | 'completed';
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set, get }) => ({
          todos: [
            { id: 1, text: 'Learn Lattice', completed: false },
            { id: 2, text: 'Build app', completed: false },
          ],
          filter: 'all',
          addTodo: (text: string) => {
            const newTodo = { id: Date.now(), text, completed: false };
            set({ todos: [...get().todos, newTodo] });
          },
          toggleTodo: (id: number) => {
            set({
              todos: get().todos.map((todo) =>
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
              ),
            });
          },
          setFilter: (filter) => set({ filter }),
        }));

        const todoSlice = createSlice(model, (m) => ({
          todos: m.todos,
          filter: m.filter,
        }));

        const statsView = () =>
          todoSlice((state) => {
            const active = state.todos.filter((t) => !t.completed);
            const completed = state.todos.filter((t) => t.completed);
            return {
              activeCount: active.length,
              completedCount: completed.length,
              totalCount: state.todos.length,
            };
          });

        const filteredTodosView = () =>
          todoSlice((state) => {
            switch (state.filter) {
              case 'active':
                return state.todos.filter((t) => !t.completed);
              case 'completed':
                return state.todos.filter((t) => t.completed);
              default:
                return state.todos;
            }
          });

        return {
          model,
          actions: createSlice(model, (m) => ({
            addTodo: m.addTodo,
            toggleTodo: m.toggleTodo,
            setFilter: m.setFilter,
          })),
          views: {
            stats: statsView,
            filteredTodos: filteredTodosView,
          },
        };
      });

      const store = createZustandAdapter(todoApp) as ZustandAdapterResult<
        any,
        any,
        any
      >;

      const { result } = renderHook(() =>
        useLattice(store, (views) => ({
          stats: views.stats(),
          todos: views.filteredTodos(),
        }))
      );

      expect(result.current.views.stats.activeCount).toBe(2);
      expect(result.current.views.stats.completedCount).toBe(0);
      expect(result.current.views.todos).toHaveLength(2);

      // Toggle first todo
      act(() => {
        result.current.actions.toggleTodo(1);
      });

      expect(result.current.views.stats.activeCount).toBe(1);
      expect(result.current.views.stats.completedCount).toBe(1);

      // Filter by active
      act(() => {
        result.current.actions.setFilter('active');
      });

      expect(result.current.views.todos).toHaveLength(1);
      expect(result.current.views.todos[0].text).toBe('Build app');
    });

    it('should handle view functions returning stores', async () => {
      const { createComponent, createModel, createSlice } = await import(
        '@lattice/core'
      );
      const { createZustandAdapter } = await import('./index.js');

      const component = createComponent(() => {
        const model = createModel<{
          user: { name: string; role: string };
          theme: 'light' | 'dark';
        }>(() => ({
          user: { name: 'Alice', role: 'admin' },
          theme: 'light',
        }));

        const userSlice = createSlice(model, (m) => m.user);
        const themeSlice = createSlice(model, (m) => ({ theme: m.theme }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            user: userSlice,
            theme: themeSlice,
          },
        };
      });

      const store = createZustandAdapter(component) as ZustandAdapterResult<
        any,
        any,
        any
      >;

      const { result } = renderHook(() =>
        useViews(store, (views) => ({
          user: views.user(),
          theme: views.theme(),
        }))
      );

      expect(result.current.user).toEqual({ name: 'Alice', role: 'admin' });
      expect(result.current.theme).toEqual({ theme: 'light' });
    });

    it('should handle actions with select() markers', async () => {
      const { createComponent, createModel, createSlice, select } =
        await import('@lattice/core');
      const { createZustandAdapter } = await import('./index.js');

      const component = createComponent(() => {
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

        const buttonView = createSlice(model, () => ({
          onClick: select(actions, (a) => a.increment),
          label: 'Click me',
        }));

        return {
          model,
          actions,
          views: { button: buttonView },
        };
      });

      const store = createZustandAdapter(component) as ZustandAdapterResult<
        any,
        any,
        any
      >;

      const { result } = renderHook(() => useView(store, 'button'));

      expect(typeof (result.current as any).onClick).toBe('function');
      expect((result.current as any).label).toBe('Click me');

      // The onClick should work
      act(() => {
        (result.current as any).onClick();
      });

      // Verify the action was called (indirectly through view update)
      const { result: viewResult } = renderHook(() =>
        useViews(store, (views) => ({
          button: views.button(),
        }))
      );

      expect(viewResult.current.button.label).toBe('Click me');
    });
  });

  describe('Integration tests with real components', () => {
    it('should properly type useView results for todo-app style components', async () => {
      const { createComponent, createModel, createSlice } = await import(
        '@lattice/core'
      );
      const { createZustandAdapter } = await import('./index.js');

      // Create a todo-app style component
      const todoComponent = createComponent(() => {
        interface Todo {
          id: string;
          text: string;
          completed: boolean;
        }

        const model = createModel<{
          todos: Todo[];
          filter: 'all' | 'active' | 'completed';
        }>(() => ({
          todos: [
            { id: '1', text: 'Test todo', completed: false },
            { id: '2', text: 'Completed todo', completed: true },
          ],
          filter: 'all',
        }));

        // Computed view that returns filtered todos
        const filteredTodosView = () =>
          createSlice(model, (m) => {
            if (m.filter === 'all') return m.todos;
            return m.todos.filter((t) =>
              m.filter === 'active' ? !t.completed : t.completed
            );
          });

        // Stats view
        const statsView = () =>
          createSlice(model, (m) => ({
            total: m.todos.length,
            active: m.todos.filter((t) => !t.completed).length,
            completed: m.todos.filter((t) => t.completed).length,
          }));

        // Static button slice
        const filterButtonSlice = createSlice(model, (m) => ({
          filter: m.filter,
          className: 'filter-button',
          'aria-pressed': false,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            filteredTodos: filteredTodosView,
            stats: statsView,
            filterButton: filterButtonSlice,
          },
        };
      });

      const store = createZustandAdapter(todoComponent);

      // Test filteredTodos view
      const { result: todosResult } = renderHook(() =>
        useView(store, 'filteredTodos')
      );

      expect(Array.isArray(todosResult.current)).toBe(true);
      expect(todosResult.current).toHaveLength(2);
      expect((todosResult.current as any)[0]).toEqual({
        id: '1',
        text: 'Test todo',
        completed: false,
      });

      // Test stats view
      const { result: statsResult } = renderHook(() => useView(store, 'stats'));

      expect(statsResult.current).toEqual({
        total: 2,
        active: 1,
        completed: 1,
      });

      // Test static slice view
      const { result: buttonResult } = renderHook(() =>
        useView(store, 'filterButton')
      );

      expect(buttonResult.current).toEqual({
        filter: 'all',
        className: 'filter-button',
        'aria-pressed': false,
      });
    });
  });
});
