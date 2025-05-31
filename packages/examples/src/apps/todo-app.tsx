/**
 * @fileoverview Complete Todo App Example
 *
 * This demonstrates building a full application with Lattice, showing:
 * - Multiple related components working together
 * - Complex state interactions
 * - Real-world UI patterns
 */

import React from 'react';
import {
  createComponent,
  createModel,
  createSlice,
  compose,
} from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useView, useActions } from '@lattice/adapter-zustand/react';
import './todo-app.css';

// ============================================================================
// Todo App Behavior Specification
// ============================================================================
const todoAppComponent = createComponent(() => {
  interface Todo {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
  }

  const model = createModel<{
    // State
    todos: Todo[];
    filter: 'all' | 'active' | 'completed';
    searchQuery: string;
    sortBy: 'date' | 'alphabetical';

    // Actions
    addTodo: (text: string) => void;
    toggleTodo: (id: string) => void;
    deleteTodo: (id: string) => void;
    editTodo: (id: string, text: string) => void;
    clearCompleted: () => void;
    toggleAll: () => void;

    // UI Actions
    setFilter: (filter: 'all' | 'active' | 'completed') => void;
    setSearchQuery: (query: string) => void;
    setSortBy: (sortBy: 'date' | 'alphabetical') => void;
  }>(({ set, get }) => ({
    // Initial state
    todos: [],
    filter: 'all',
    searchQuery: '',
    sortBy: 'date',

    // Todo actions
    addTodo: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const newTodo: Todo = {
        id: `${Date.now()}-${Math.random()}`,
        text: trimmed,
        completed: false,
        createdAt: Date.now(),
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

    deleteTodo: (id) => {
      set({ todos: get().todos.filter((todo) => todo.id !== id) });
    },

    editTodo: (id, text) => {
      const trimmed = text.trim();
      if (!trimmed) {
        get().deleteTodo(id);
        return;
      }

      set({
        todos: get().todos.map((todo) =>
          todo.id === id ? { ...todo, text: trimmed } : todo
        ),
      });
    },

    clearCompleted: () => {
      set({ todos: get().todos.filter((todo) => !todo.completed) });
    },

    toggleAll: () => {
      const allCompleted = get().todos.every((todo) => todo.completed);
      set({
        todos: get().todos.map((todo) => ({
          ...todo,
          completed: !allCompleted,
        })),
      });
    },

    // UI actions
    setFilter: (filter) => set({ filter }),
    setSearchQuery: (query) => set({ searchQuery: query.toLowerCase() }),
    setSortBy: (sortBy) => set({ sortBy }),
  }));

  // Actions slice
  const actions = createSlice(model, (m) => ({
    addTodo: m.addTodo,
    toggleTodo: m.toggleTodo,
    deleteTodo: m.deleteTodo,
    editTodo: m.editTodo,
    clearCompleted: m.clearCompleted,
    toggleAll: m.toggleAll,
    setFilter: m.setFilter,
    setSearchQuery: m.setSearchQuery,
    setSortBy: m.setSortBy,
  }));

  // State slices
  const todosSlice = createSlice(model, (m) => ({
    todos: m.todos,
    filter: m.filter,
    searchQuery: m.searchQuery,
    sortBy: m.sortBy,
  }));

  const uiSlice = createSlice(model, (m) => ({
    filter: m.filter,
    searchQuery: m.searchQuery,
    sortBy: m.sortBy,
  }));

  // Computed todos view
  const filteredTodosView = () =>
    todosSlice((state) => {
      let filtered = state.todos;

      // Apply search filter
      if (state.searchQuery) {
        filtered = filtered.filter((todo) =>
          todo.text.toLowerCase().includes(state.searchQuery)
        );
      }

      // Apply status filter
      if (state.filter !== 'all') {
        filtered = filtered.filter((todo) =>
          state.filter === 'active' ? !todo.completed : todo.completed
        );
      }

      // Apply sorting
      filtered = [...filtered].sort((a, b) => {
        if (state.sortBy === 'alphabetical') {
          return a.text.localeCompare(b.text);
        }
        return b.createdAt - a.createdAt; // Newest first
      });

      return filtered;
    });

  // Stats view
  const statsView = () =>
    todosSlice((state) => {
      const total = state.todos.length;
      const completed = state.todos.filter((t) => t.completed).length;
      const active = total - completed;

      return {
        total,
        active,
        completed,
        hasCompleted: completed > 0,
        allCompleted: total > 0 && active === 0,
      };
    });

  // Filter button factory
  const createFilterButton = (filterType: 'all' | 'active' | 'completed') =>
    createSlice(
      model,
      compose({ actions, ui: uiSlice }, (_, { actions, ui }) => ({
        onClick: () => actions.setFilter(filterType),
        className: ui.filter === filterType ? 'selected' : '',
        'aria-pressed': ui.filter === filterType,
        children: filterType.charAt(0).toUpperCase() + filterType.slice(1),
      }))
    );

  return {
    model,
    actions,
    views: {
      filteredTodos: filteredTodosView,
      stats: statsView,

      // Individual filter buttons
      filterButtonAll: createFilterButton('all'),
      filterButtonActive: createFilterButton('active'),
      filterButtonCompleted: createFilterButton('completed'),

      // Clear button
      clearButton: createSlice(
        model,
        compose({ actions, stats: statsView() }, (_, { actions, stats }) => ({
          onClick: actions.clearCompleted,
          disabled: !stats.hasCompleted,
          children: `Clear completed (${stats.completed})`,
        }))
      ),

      // Toggle all checkbox
      toggleAllCheckbox: createSlice(
        model,
        compose({ actions, stats: statsView() }, (_, { actions, stats }) => ({
          onChange: actions.toggleAll,
          checked: stats.allCompleted,
          disabled: stats.total === 0,
          'aria-label': 'Toggle all todos',
        }))
      ),
    },
  };
});

// ============================================================================
// Create the store
// ============================================================================
const todoStore = createZustandAdapter(todoAppComponent);

// ============================================================================
// React Components
// ============================================================================
interface TodoItemType {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

function TodoItem({ todo }: { todo: TodoItemType }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(todo.text);
  const actions = useActions(todoStore);

  const handleSubmit = () => {
    actions.editTodo(todo.id, editText);
    setIsEditing(false);
  };

  return (
    <li className={todo.completed ? 'completed' : ''}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => actions.toggleTodo(todo.id)}
      />

      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') {
              setEditText(todo.text);
              setIsEditing(false);
            }
          }}
          autoFocus
        />
      ) : (
        <span onDoubleClick={() => setIsEditing(true)}>{todo.text}</span>
      )}

      <button onClick={() => actions.deleteTodo(todo.id)}>×</button>
    </li>
  );
}

function TodoList() {
  const todos = useView(todoStore, 'filteredTodos');

  if (!todos || todos.length === 0) {
    return <p className="empty">No todos found</p>;
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}

function TodoInput() {
  const [input, setInput] = React.useState('');
  const actions = useActions(todoStore);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    actions.addTodo(input);
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="todo-input">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What needs to be done?"
        autoFocus
      />
    </form>
  );
}

function TodoFilters() {
  const allButton = useView(todoStore, 'filterButtonAll');
  const activeButton = useView(todoStore, 'filterButtonActive');
  const completedButton = useView(todoStore, 'filterButtonCompleted');

  return (
    <div className="filters">
      <button {...allButton} />
      <button {...activeButton} />
      <button {...completedButton} />
    </div>
  );
}

function TodoStats() {
  const stats = useView(todoStore, 'stats');
  const clearButton = useView(todoStore, 'clearButton');
  const toggleAll = useView(todoStore, 'toggleAllCheckbox');

  return (
    <div className="stats">
      <label>
        <input type="checkbox" {...toggleAll} />
        <span>{stats.active} items left</span>
      </label>

      <button {...clearButton} />
    </div>
  );
}

function SearchBar() {
  const actions = useActions(todoStore);

  return (
    <input
      type="search"
      placeholder="Search todos..."
      onChange={(e) => actions.setSearchQuery(e.target.value)}
      className="search-bar"
    />
  );
}

// ============================================================================
// Main App Component
// ============================================================================
export function TodoApp() {
  return (
    <div className="todo-app">
      <header>
        <h1>todos</h1>
        <TodoInput />
      </header>

      <main>
        <SearchBar />
        <TodoFilters />
        <TodoStats />
        <TodoList />
      </main>
    </div>
  );
}

// ============================================================================
// Export for testing
// ============================================================================
export { todoAppComponent, todoStore };
