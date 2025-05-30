/**
 * @fileoverview Example demonstrating improved type safety in React hooks
 * 
 * This example shows how the updated hooks provide strong type inference
 * without any `any` types leaking through.
 */

import React from 'react';
import { createComponent, createModel, createSlice, select } from '@lattice/core';
import { createZustandAdapter } from '../src/index.js';
import {
  useStore,
  useModelSelector,
  useAction,
  useActions,
  useView,
} from '../src/react.js';

// Define a strongly-typed component
const todoApp = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    // State
    todos: [] as Array<{ id: number; text: string; completed: boolean }>,
    filter: 'all' as 'all' | 'active' | 'completed',
    newTodoText: '',
    
    // Actions
    addTodo: (text: string) => {
      const todo = { id: Date.now(), text, completed: false };
      set({ todos: [...get().todos, todo] });
    },
    toggleTodo: (id: number) => {
      set({
        todos: get().todos.map(todo =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        ),
      });
    },
    deleteTodo: (id: number) => {
      set({ todos: get().todos.filter(todo => todo.id !== id) });
    },
    setFilter: (filter: 'all' | 'active' | 'completed') => {
      set({ filter });
    },
    setNewTodoText: (text: string) => {
      set({ newTodoText: text });
    },
    clearCompleted: () => {
      set({ todos: get().todos.filter(todo => !todo.completed) });
    },
  }));

  const actions = createSlice(model, (m) => ({
    addTodo: m.addTodo,
    toggleTodo: m.toggleTodo,
    deleteTodo: m.deleteTodo,
    setFilter: m.setFilter,
    setNewTodoText: m.setNewTodoText,
    clearCompleted: m.clearCompleted,
  }));

  // Static view slices
  const todoListSlice = createSlice(model, (m) => ({
    todos: m.todos,
    filter: m.filter,
  }));

  const inputSlice = createSlice(model, (m) => ({
    value: m.newTodoText,
    onChange: select(actions, (a) => a.setNewTodoText),
    onSubmit: select(actions, (a) => a.addTodo),
  }));

  // Computed view
  const statsView = () => todoListSlice((state) => {
    const active = state.todos.filter(t => !t.completed);
    const completed = state.todos.filter(t => t.completed);
    const filtered = state.filter === 'all' 
      ? state.todos
      : state.filter === 'active' 
        ? active 
        : completed;

    return {
      activeCount: active.length,
      completedCount: completed.length,
      totalCount: state.todos.length,
      filteredTodos: filtered,
      hasCompleted: completed.length > 0,
    };
  });

  return {
    model,
    actions,
    views: {
      todoList: todoListSlice,
      input: inputSlice,
      stats: statsView,
    },
  };
});

// Create the store
const todoStore = createZustandAdapter(todoApp);

// ============================================================================
// React Components with Strong Type Safety
// ============================================================================

/**
 * Example 1: Using useModelSelector with direct selector hooks
 */
function TodoInput() {
  // Direct selector hook usage - full type inference!
  const newTodoText = useModelSelector(todoStore.use.newTodoText); // string
  
  // Get actions with proper types
  const addTodo = useAction(todoStore, 'addTodo'); // (text: string) => void
  const setNewTodoText = useAction(todoStore, 'setNewTodoText'); // (text: string) => void

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      addTodo(newTodoText);
      setNewTodoText('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={newTodoText}
        onChange={(e) => setNewTodoText(e.target.value)}
        placeholder="What needs to be done?"
      />
      <button type="submit">Add</button>
    </form>
  );
}

/**
 * Example 2: Using views with proper type inference
 */
function TodoList() {
  // Views are fully typed
  const stats = useView(todoStore, 'stats'); // Properly typed stats object
  const toggleTodo = useAction(todoStore, 'toggleTodo'); // (id: number) => void
  const deleteTodo = useAction(todoStore, 'deleteTodo'); // (id: number) => void

  return (
    <div>
      <h3>
        {stats.activeCount} active, {stats.completedCount} completed
      </h3>
      <ul>
        {stats.filteredTodos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
              {todo.text}
            </span>
            <button onClick={() => deleteTodo(todo.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example 3: Using all actions at once with proper types
 */
function TodoFilters() {
  const filter = useModelSelector(todoStore.use.filter); // 'all' | 'active' | 'completed'
  const actions = useActions(todoStore); // All actions with proper types
  
  const filters: Array<'all' | 'active' | 'completed'> = ['all', 'active', 'completed'];

  return (
    <div>
      {filters.map(f => (
        <button
          key={f}
          onClick={() => actions.setFilter(f)}
          style={{ fontWeight: filter === f ? 'bold' : 'normal' }}
        >
          {f}
        </button>
      ))}
      <button onClick={actions.clearCompleted}>
        Clear Completed
      </button>
    </div>
  );
}

/**
 * Example 4: Using custom selectors for derived state
 */
function TodoSummary() {
  // Complex selector with full type inference
  const summary = useStore(todoStore, (state) => {
    const todos = state.todos;
    const recentTodos = todos.slice(-3);
    const urgentCount = todos.filter(t => 
      !t.completed && t.text.toLowerCase().includes('urgent')
    ).length;
    
    return {
      total: todos.length,
      recent: recentTodos,
      urgentCount,
      allCompleted: todos.length > 0 && todos.every(t => t.completed),
    };
  });

  return (
    <div>
      <h4>Summary</h4>
      <p>Total todos: {summary.total}</p>
      <p>Urgent todos: {summary.urgentCount}</p>
      {summary.allCompleted && <p>🎉 All todos completed!</p>}
      <h5>Recent todos:</h5>
      <ul>
        {summary.recent.map(todo => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example 5: Demonstrating type errors are caught
 */
function TypeSafetyDemo() {
  // These would all cause TypeScript errors:
  
  // ❌ Type error: 'notAProperty' doesn't exist
  // const invalid = useModelSelector(todoStore.use.notAProperty);
  
  // ❌ Type error: 'notAnAction' doesn't exist
  // const invalidAction = useAction(todoStore, 'notAnAction');
  
  // ❌ Type error: wrong parameter type
  // const addTodo = useAction(todoStore, 'addTodo');
  // addTodo(123); // expects string
  
  // ❌ Type error: 'notAView' doesn't exist
  // const invalidView = useView(todoStore, 'notAView');
  
  // ✅ All of these work with proper types
  const todos = useModelSelector(todoStore.use.todos);
  const filter = useModelSelector(todoStore.use.filter);
  const actions = useActions(todoStore);
  
  return (
    <div>
      <p>Type safety ensures all these values are properly typed:</p>
      <p>Todos: {todos.length} items (Array type)</p>
      <p>Filter: {filter} (union type: 'all' | 'active' | 'completed')</p>
      <p>Actions: {Object.keys(actions).length} methods</p>
    </div>
  );
}

// Main App component
export function App() {
  return (
    <div>
      <h1>Todo App with Type-Safe Hooks</h1>
      <TodoInput />
      <TodoFilters />
      <TodoList />
      <TodoSummary />
      <TypeSafetyDemo />
    </div>
  );
}