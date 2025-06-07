/**
 * @fileoverview Complete Todo App Example - Updated for API Parameter
 *
 * This demonstrates building a full application with Lattice, showing:
 * - Multiple related components working together
 * - Complex state interactions
 * - Real-world UI patterns
 * - API parameter usage for debugging and performance tracking
 */

import React from 'react';
import { createModel, createSlice, compose } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useViews } from '@lattice/runtime/react';
import './todo-app.css';

// For browser compatibility with process.env
declare const process: { env: { NODE_ENV: string } } | undefined;

// ============================================================================
// Todo App Behavior Specification
// ============================================================================
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

const todoAppComponent = () => {
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
    addTodo: (text: string) => {
      if (
        typeof process !== 'undefined' &&
        process.env?.NODE_ENV === 'development'
      ) {
        console.log('[TodoApp] Adding todo:', text);
      }
      m.addTodo(text);
    },
    toggleTodo: m.toggleTodo,
    deleteTodo: m.deleteTodo,
    editTodo: m.editTodo,
    clearCompleted: () => {
      m.clearCompleted();
    },
    toggleAll: m.toggleAll,
    setFilter: m.setFilter,
    setSearchQuery: m.setSearchQuery,
    setSortBy: m.setSortBy,
  }));

  // Computed views that process todos
  const todosProcessor = createSlice(model, (m) => {
    // Return an object with computed values
    const filtered = (() => {
      let result = m.todos;

      // Log filtering operations in development
      if (
        typeof process !== 'undefined' &&
        process.env?.NODE_ENV === 'development'
      ) {
        console.log('[TodoApp] Processing todos:', {
          totalCount: m.todos.length,
          filter: m.filter,
          searchQuery: m.searchQuery,
          sortBy: m.sortBy,
        });
      }

      // Apply search filter
      if (m.searchQuery) {
        result = result.filter((todo) =>
          todo.text.toLowerCase().includes(m.searchQuery)
        );
      }

      // Apply status filter
      if (m.filter !== 'all') {
        result = result.filter((todo) =>
          m.filter === 'active' ? !todo.completed : todo.completed
        );
      }

      // Apply sorting
      result = [...result].sort((a, b) => {
        if (m.sortBy === 'alphabetical') {
          return a.text.localeCompare(b.text);
        }
        return b.createdAt - a.createdAt; // Newest first
      });

      return result;
    })();

    // Calculate stats with performance tracking
    const startTime = performance.now();
    const total = m.todos.length;
    const completed = m.todos.filter((t) => t.completed).length;
    const active = total - completed;

    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV === 'development'
    ) {
      const endTime = performance.now();
      console.log(
        `[TodoApp] Stats calculation took ${(endTime - startTime).toFixed(2)}ms`
      );
    }

    return {
      filteredTodos: filtered,
      stats: {
        total,
        active,
        completed,
        hasCompleted: completed > 0,
        allCompleted: total > 0 && active === 0,
      },
    };
  });

  // Filter button slices
  const allFilterButton = createSlice(
    model,
    compose({ actions, processor: todosProcessor }, (m, { actions }) => ({
      onClick: () => actions.setFilter('all'),
      className: m.filter === 'all' ? 'selected' : '',
      'aria-pressed': m.filter === 'all',
      children: 'All',
    }))
  );

  const activeFilterButton = createSlice(
    model,
    compose({ actions, processor: todosProcessor }, (m, { actions }) => ({
      onClick: () => actions.setFilter('active'),
      className: m.filter === 'active' ? 'selected' : '',
      'aria-pressed': m.filter === 'active',
      children: 'Active',
    }))
  );

  const completedFilterButton = createSlice(
    model,
    compose({ actions, processor: todosProcessor }, (m, { actions }) => ({
      onClick: () => actions.setFilter('completed'),
      className: m.filter === 'completed' ? 'selected' : '',
      'aria-pressed': m.filter === 'completed',
      children: 'Completed',
    }))
  );

  return {
    model,
    actions,
    views: {
      // Direct access to processor results
      processor: todosProcessor,

      // Individual filter buttons
      filterButtonAll: allFilterButton,
      filterButtonActive: activeFilterButton,
      filterButtonCompleted: completedFilterButton,

      // Clear button
      clearButton: createSlice(
        model,
        compose(
          { actions, processor: todosProcessor },
          (_, { actions, processor }) => ({
            onClick: () => actions.clearCompleted(),
            disabled: !processor.stats.hasCompleted,
            children: `Clear completed (${processor.stats.completed})`,
          })
        )
      ),

      // Toggle all checkbox
      toggleAllCheckbox: createSlice(
        model,
        compose(
          { actions, processor: todosProcessor },
          (_, { actions, processor }) => ({
            onChange: () => actions.toggleAll(),
            checked: processor.stats.allCompleted,
            disabled: processor.stats.total === 0,
            'aria-label': 'Toggle all todos',
          })
        )
      ),
    },
  };
};

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
  const actions = todoStore.actions;

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
  const todos = useViews(todoStore, (views) => views.processor().filteredTodos);

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
  const actions = todoStore.actions;

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
  const { allButton, activeButton, completedButton } = useViews(
    todoStore,
    (views) => ({
      allButton: views.filterButtonAll(),
      activeButton: views.filterButtonActive(),
      completedButton: views.filterButtonCompleted(),
    })
  );

  return (
    <div className="filters">
      <button {...allButton} />
      <button {...activeButton} />
      <button {...completedButton} />
    </div>
  );
}

function TodoStats() {
  const { stats, clearButton, toggleAll } = useViews(todoStore, (views) => ({
    stats: views.processor().stats,
    clearButton: views.clearButton(),
    toggleAll: views.toggleAllCheckbox(),
  }));

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
  const actions = todoStore.actions;

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
