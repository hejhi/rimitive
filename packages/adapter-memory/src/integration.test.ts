import { describe, it, expect } from 'vitest';
import { createModel, createSlice, createComponent } from '@lattice/core';
import { createMemoryAdapter } from './index';

describe('Memory Adapter Integration', () => {
  it('should work with a complete Lattice component', () => {
    // Define a todo list component using Lattice patterns
    const todoList = createComponent(() => {
      const model = createModel<{
        todos: Array<{ id: number; text: string; completed: boolean }>;
        filter: 'all' | 'active' | 'completed';
        addTodo: (text: string) => void;
        toggleTodo: (id: number) => void;
        setFilter: (filter: 'all' | 'active' | 'completed') => void;
      }>(({ set, get }) => ({
        todos: [],
        filter: 'all',
        
        addTodo: (text: string) => {
          const newTodo = { id: Date.now(), text, completed: false };
          set({ todos: [...get().todos, newTodo] });
        },
        
        toggleTodo: (id: number) => {
          set({
            todos: get().todos.map(todo =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
          });
        },
        
        setFilter: (filter: 'all' | 'active' | 'completed') => {
          set({ filter });
        }
      }));

      const actions = createSlice(model, (m) => ({
        addTodo: m.addTodo,
        toggleTodo: m.toggleTodo,
        setFilter: m.setFilter
      }));

      const todoState = createSlice(model, (m) => ({
        todos: m.todos,
        filter: m.filter
      }));

      return {
        model,
        actions,
        views: {
          todoState
        }
      };
    });

    // Create instance using the memory adapter
    const { model } = todoList();
    const adapter = createMemoryAdapter();
    const store = adapter(model);

    // Test initial state
    expect(store.getState().todos).toEqual([]);
    expect(store.getState().filter).toBe('all');

    // Test adding todos
    store.getState().addTodo('Learn Lattice');
    expect(store.getState().todos).toHaveLength(1);
    expect(store.getState().todos[0]?.text).toBe('Learn Lattice');
    expect(store.getState().todos[0]?.completed).toBe(false);

    const firstTodoId = store.getState().todos[0]?.id || 0;

    store.getState().addTodo('Build something awesome');
    expect(store.getState().todos).toHaveLength(2);

    // Test toggling todos
    store.getState().toggleTodo(firstTodoId);
    expect(store.getState().todos[0]?.completed).toBe(true);

    // Test filter changes
    store.getState().setFilter('active');
    expect(store.getState().filter).toBe('active');

    // Test subscriptions
    let notificationCount = 0;
    const unsubscribe = store.subscribe(() => {
      notificationCount++;
    });

    store.getState().addTodo('Test subscriptions');
    expect(notificationCount).toBe(1);

    store.getState().toggleTodo(firstTodoId);
    expect(notificationCount).toBe(2);

    unsubscribe();
    store.getState().setFilter('all');
    expect(notificationCount).toBe(2); // Should not increase after unsubscribe
  });

  it('should handle computed values and derived state', () => {
    const counter = createComponent(() => {
      const model = createModel<{
        count: number;
        step: number;
        increment: () => void;
        decrement: () => void;
        setStep: (step: number) => void;
      }>(({ set, get }) => ({
        count: 0,
        step: 1,
        increment: () => set({ count: get().count + get().step }),
        decrement: () => set({ count: get().count - get().step }),
        setStep: (step: number) => set({ step })
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
        decrement: m.decrement,
        setStep: m.setStep
      }));

      return { model, actions, views: {} };
    });

    const { model } = counter();
    const adapter = createMemoryAdapter();
    const store = adapter(model);

    // Test basic operations
    expect(store.getState().count).toBe(0);
    store.getState().increment();
    expect(store.getState().count).toBe(1);

    // Test with different step
    store.getState().setStep(5);
    store.getState().increment();
    expect(store.getState().count).toBe(6);

    store.getState().decrement();
    expect(store.getState().count).toBe(1);
  });

  it('should maintain referential stability for unchanged values', () => {
    const model = createModel<{
      user: { name: string; email: string };
      settings: { theme: string; notifications: boolean };
      updateUserName: (name: string) => void;
      updateTheme: (theme: string) => void;
    }>(({ set, get }) => ({
      user: { name: 'John', email: 'john@example.com' },
      settings: { theme: 'light', notifications: true },
      updateUserName: (name: string) =>
        set({ user: { ...get().user, name } }),
      updateTheme: (theme: string) =>
        set({ settings: { ...get().settings, theme } })
    }));

    const adapter = createMemoryAdapter();
    const store = adapter(model);

    const initialSettings = store.getState().settings;
    
    // Update user (shouldn't affect settings reference)
    store.getState().updateUserName('Jane');
    
    const settingsAfterUserUpdate = store.getState().settings;
    expect(settingsAfterUserUpdate).toBe(initialSettings);
    
    // Update theme (should create new settings reference)
    store.getState().updateTheme('dark');
    
    const settingsAfterThemeUpdate = store.getState().settings;
    expect(settingsAfterThemeUpdate).not.toBe(initialSettings);
    expect(settingsAfterThemeUpdate.theme).toBe('dark');
  });
});