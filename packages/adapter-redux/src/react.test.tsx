import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import {
  createComponent,
  createModel,
  createSlice,
  compose,
} from '@lattice/core';
import { createReduxAdapter } from './index';
import { useView, useActions, useSelector } from './react';

describe('Redux React Integration', () => {
  afterEach(() => {
    cleanup();
  });
  function createTestComponent() {
    return createComponent(() => {
      const model = createModel<{
        count: number;
        increment: () => void;
        decrement: () => void;
        disabled: boolean;
        setDisabled: (disabled: boolean) => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        disabled: false,
        setDisabled: (disabled) => set({ disabled }),
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
        decrement: m.decrement,
        setDisabled: m.setDisabled,
      }));

      const displaySlice = createSlice(model, (m) => ({
        value: m.count,
        label: `Count: ${m.count}`,
        isEven: m.count % 2 === 0,
      }));

      const buttonSlice = createSlice(
        model,
        compose({ actions }, (m, { actions }) => ({
          onClick: actions.increment,
          disabled: m.disabled,
          'aria-label': `Increment counter`,
        }))
      );

      return {
        model,
        actions,
        views: {
          display: displaySlice,
          button: buttonSlice,
        },
      };
    });
  }

  it('should provide working useView hook', async () => {
    const component = createTestComponent();
    const store = createReduxAdapter(component);

    const { result } = renderHook(() =>
      useView(store, (views) => views.display)
    );

    expect(result.current.value).toBe(0);
    expect(result.current.label).toBe('Count: 0');
    expect(result.current.isEven).toBe(true);

    // Update state
    act(() => {
      store.actions.increment();
    });

    // Wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Hook should update
    expect(result.current.value).toBe(1);
    expect(result.current.label).toBe('Count: 1');
    expect(result.current.isEven).toBe(false);
  });

  it('should provide stable actions through useActions', () => {
    const component = createTestComponent();
    const store = createReduxAdapter(component);

    const { result, rerender } = renderHook(() => useActions(store));

    const firstActions = result.current;
    expect(typeof firstActions.increment).toBe('function');
    expect(typeof firstActions.decrement).toBe('function');

    // Rerender
    rerender();

    const secondActions = result.current;

    // Actions should be the same reference
    expect(firstActions).toBe(secondActions);
    expect(firstActions.increment).toBe(secondActions.increment);
    expect(firstActions.decrement).toBe(secondActions.decrement);
  });

  it('should handle views with compose()', async () => {
    const component = createTestComponent();
    const store = createReduxAdapter(component);

    const { result } = renderHook(() =>
      useView(store, (views) => views.button)
    );

    expect(result.current.disabled).toBe(false);
    expect(result.current['aria-label']).toBe('Increment counter');
    expect(typeof result.current.onClick).toBe('function');

    // Test that onClick works
    act(() => {
      result.current.onClick();
    });

    // Wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify state was updated
    expect(store.getState().count).toBe(1);

    // Update disabled state
    act(() => {
      store.actions.setDisabled(true);
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.disabled).toBe(true);
  });

  it('should support dynamic view selection', async () => {
    const component = createComponent(() => {
      const model = createModel<{
        activeTab: 'overview' | 'details' | 'settings';
        overviewData: string;
        detailsData: string;
        settingsData: string;
        setActiveTab: (tab: 'overview' | 'details' | 'settings') => void;
      }>(({ set }) => ({
        activeTab: 'overview',
        overviewData: 'Overview content',
        detailsData: 'Details content',
        settingsData: 'Settings content',
        setActiveTab: (tab) => set({ activeTab: tab }),
      }));

      const overviewSlice = createSlice(model, (m) => ({
        content: m.overviewData,
        isActive: m.activeTab === 'overview',
      }));

      const detailsSlice = createSlice(model, (m) => ({
        content: m.detailsData,
        isActive: m.activeTab === 'details',
      }));

      const settingsSlice = createSlice(model, (m) => ({
        content: m.settingsData,
        isActive: m.activeTab === 'settings',
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({
          setActiveTab: m.setActiveTab,
        })),
        views: {
          overview: overviewSlice,
          details: detailsSlice,
          settings: settingsSlice,
        },
      };
    });

    const store = createReduxAdapter(component);

    let currentTab: 'overview' | 'details' | 'settings' = 'overview';

    const { result, rerender } = renderHook(() =>
      useView(store, (views) => views[currentTab])
    );

    expect(result.current.content).toBe('Overview content');
    expect(result.current.isActive).toBe(true);

    // Change tab
    currentTab = 'details';
    rerender();

    expect(result.current.content).toBe('Details content');
    expect(result.current.isActive).toBe(false);

    // Make details active
    act(() => {
      store.actions.setActiveTab('details');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.isActive).toBe(true);
  });

  it('should handle computed views', async () => {
    const component = createComponent(() => {
      const model = createModel<{
        items: string[];
        filter: string;
        addItem: (item: string) => void;
        setFilter: (filter: string) => void;
      }>(({ set, get }) => ({
        items: ['apple', 'banana', 'cherry'],
        filter: '',
        addItem: (item) => set({ items: [...get().items, item] }),
        setFilter: (filter) => set({ filter }),
      }));

      const itemsSlice = createSlice(model, (m) => ({
        items: m.items,
        filter: m.filter,
      }));

      const filteredItemsView = createSlice(model, (m) => {
        const state = itemsSlice(m);
        const filtered = state.filter
          ? state.items.filter((item) =>
              item.toLowerCase().includes(state.filter.toLowerCase())
            )
          : state.items;

        return {
          items: filtered,
          count: filtered.length,
          hasResults: filtered.length > 0,
          searchTerm: state.filter,
        };
      });

      return {
        model,
        actions: createSlice(model, (m) => ({
          addItem: m.addItem,
          setFilter: m.setFilter,
        })),
        views: {
          filteredItems: filteredItemsView,
        },
      };
    });

    const store = createReduxAdapter(component);

    const { result } = renderHook(() =>
      useView(store, (views) => views.filteredItems)
    );

    const data = result.current;
    expect(data.count).toBe(3);
    expect(data.hasResults).toBe(true);
    expect(data.items).toEqual(['apple', 'banana', 'cherry']);

    // Apply filter
    act(() => {
      store.actions.setFilter('a');
    });

    const filteredData = result.current;
    expect(filteredData.count).toBe(2);
    expect(filteredData.items).toEqual(['apple', 'banana']);
    expect(filteredData.searchTerm).toBe('a');

    // Add new item
    act(() => {
      store.actions.addItem('apricot');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const finalData = result.current;
    expect(finalData.count).toBe(3);
    expect(finalData.items).toEqual(['apple', 'banana', 'apricot']);
  });

  it('should work with useSelector for direct state access', async () => {
    const component = createTestComponent();
    const store = createReduxAdapter(component);

    // Create Redux store that syncs with our Lattice store
    const reduxStore = configureStore({
      reducer: (state = store.getState(), action) => {
        if (action.type === 'SYNC') {
          return store.getState();
        }
        return state;
      },
    });

    // Subscribe to Lattice store and sync to Redux
    store.subscribe(() => {
      reduxStore.dispatch({ type: 'SYNC' });
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store: reduxStore, children });

    const { result } = renderHook(
      () => ({
        count: useSelector((state) => state.count),
        disabled: useSelector((state) => state.disabled),
        computed: useSelector((state) => ({
          doubled: state.count * 2,
          isPositive: state.count > 0,
        })),
      }),
      { wrapper }
    );

    expect(result.current.count).toBe(0);
    expect(result.current.disabled).toBe(false);
    expect(result.current.computed.doubled).toBe(0);
    expect(result.current.computed.isPositive).toBe(false);

    // Update via Lattice store
    act(() => {
      store.actions.increment();
      store.actions.increment();
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.count).toBe(2);
    expect(result.current.computed.doubled).toBe(4);
    expect(result.current.computed.isPositive).toBe(true);
  });

  it('should handle complex nested views', async () => {
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
      priority: 'low' | 'medium' | 'high';
    }

    const component = createComponent(() => {
      const model = createModel<{
        todos: Todo[];
        filter: 'all' | 'active' | 'completed';
        sortBy: 'priority' | 'text' | 'id';
        addTodo: (text: string, priority: 'low' | 'medium' | 'high') => void;
        toggleTodo: (id: number) => void;
        setFilter: (filter: 'all' | 'active' | 'completed') => void;
        setSortBy: (sortBy: 'priority' | 'text' | 'id') => void;
      }>(({ set, get }) => ({
        todos: [
          { id: 1, text: 'Learn Redux', completed: true, priority: 'high' },
          { id: 2, text: 'Build app', completed: false, priority: 'medium' },
          { id: 3, text: 'Test code', completed: false, priority: 'high' },
        ],
        filter: 'all',
        sortBy: 'id',
        addTodo: (text, priority) => {
          const newTodo: Todo = {
            id: Date.now(),
            text,
            completed: false,
            priority,
          };
          set({ todos: [...get().todos, newTodo] });
        },
        toggleTodo: (id) => {
          set({
            todos: get().todos.map((todo) =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            ),
          });
        },
        setFilter: (filter) => set({ filter }),
        setSortBy: (sortBy) => set({ sortBy }),
      }));

      const todoStateSlice = createSlice(model, (m) => ({
        todos: m.todos,
        filter: m.filter,
        sortBy: m.sortBy,
      }));

      const filteredTodosView = createSlice(model, (m) => {
        const state = todoStateSlice(m);
        // Filter
        let filtered =
          state.filter === 'all'
            ? state.todos
            : state.todos.filter((t) =>
                state.filter === 'active' ? !t.completed : t.completed
              );

        // Sort
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        filtered = [...filtered].sort((a, b) => {
          switch (state.sortBy) {
            case 'priority':
              return priorityOrder[b.priority] - priorityOrder[a.priority];
            case 'text':
              return a.text.localeCompare(b.text);
            case 'id':
              return a.id - b.id;
          }
        });

        // Stats
        const total = state.todos.length;
        const completed = state.todos.filter((t) => t.completed).length;
        const active = total - completed;

        return {
          items: filtered,
          stats: {
            total,
            active,
            completed,
            percentComplete:
              total > 0 ? Math.round((completed / total) * 100) : 0,
          },
        };
      });

      return {
        model,
        actions: createSlice(model, (m) => ({
          addTodo: m.addTodo,
          toggleTodo: m.toggleTodo,
          setFilter: m.setFilter,
          setSortBy: m.setSortBy,
        })),
        views: {
          filteredTodos: filteredTodosView,
        },
      };
    });

    const store = createReduxAdapter(component);

    const { result } = renderHook(() =>
      useView(store, (views) => views.filteredTodos)
    );

    // Initial state
    const initialData = result.current;
    expect(initialData.items.length).toBe(3);
    expect(initialData.stats.total).toBe(3);
    expect(initialData.stats.active).toBe(2);
    expect(initialData.stats.completed).toBe(1);
    expect(initialData.stats.percentComplete).toBe(33);

    // Filter active
    act(() => {
      store.actions.setFilter('active');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const activeData = result.current;
    expect(activeData.items.length).toBe(2);
    expect(activeData.items.every((t) => !t.completed)).toBe(true);

    // Sort by priority
    act(() => {
      store.actions.setSortBy('priority');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const sortedData = result.current;
    expect(sortedData.items[0]?.priority).toBe('high');
    expect(sortedData.items[1]?.priority).toBe('medium');

    // Add new high priority todo
    act(() => {
      store.actions.addTodo('Urgent task', 'high');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const updatedData = result.current;
    expect(updatedData.items.length).toBe(3); // Still filtered to active
    expect(updatedData.stats.total).toBe(4);
    expect(updatedData.stats.active).toBe(3);
  });
});
