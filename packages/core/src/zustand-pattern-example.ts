/**
 * Example of the Zustand-like pattern for slices with lazy computed values
 */

import { createModel, createSlice } from './index';

// Example: Todo app with the new pattern
export const todoExample = () => {
  const model = createModel<{
    todos: Array<{ id: string; text: string; done: boolean }>;
    filter: 'all' | 'active' | 'completed';
    addTodo: (text: string) => void;
    toggleTodo: (id: string) => void;
    setFilter: (filter: 'all' | 'active' | 'completed') => void;
  }>(({ set, get }) => ({
    todos: [],
    filter: 'all',
    addTodo: (text) => {
      const newTodo = { id: Date.now().toString(), text, done: false };
      set({ todos: [...get().todos, newTodo] });
    },
    toggleTodo: (id) => {
      set({
        todos: get().todos.map((t) =>
          t.id === id ? { ...t, done: !t.done } : t
        ),
      });
    },
    setFilter: (filter) => set({ filter }),
  }));

  // Old pattern - everything is computed immediately
  const oldStatsSlice = createSlice(model, (m) => ({
    // These are computed on every slice execution
    total: m.todos.length,
    active: m.todos.filter((t) => !t.done).length,
    completed: m.todos.filter((t) => t.done).length,
  }));

  // New Zustand-like pattern - computed values are lazy getters
  const statsSlice = createSlice(model, (m) => ({
    // Static values can still be direct
    filter: m.filter,
    
    // Computed values are now functions (lazy getters)
    total: () => m.todos.length,
    active: () => m.todos.filter((t) => !t.done).length,
    completed: () => m.todos.filter((t) => t.done).length,
    
    // Can compose other slices naturally
    filteredTodos: () => {
      switch (m.filter) {
        case 'active':
          return m.todos.filter((t) => !t.done);
        case 'completed':
          return m.todos.filter((t) => t.done);
        default:
          return m.todos;
      }
    },
  }));

  // Actions slice remains the same
  const actions = createSlice(model, (m) => ({
    addTodo: m.addTodo,
    toggleTodo: m.toggleTodo,
    setFilter: m.setFilter,
  }));

  // Views can use the lazy getters
  const views = {
    // Direct slice view
    stats: statsSlice,
    
    // Computed view that uses the slice
    summary: () => {
      const stats = statsSlice(() => model);
      return {
        text: `${stats.active()} active, ${stats.completed()} completed`,
        progress: stats.total() > 0 ? stats.completed() / stats.total() : 0,
      };
    },
  };

  return { model, actions, views };
};

// Benefits of this pattern:
// 1. Lazy evaluation - only compute what's needed
// 2. No need for compose() - just call other slices/getters
// 3. Clear separation between static and computed values
// 4. Natural memoization points for each getter
// 5. Consistent with Zustand's mental model