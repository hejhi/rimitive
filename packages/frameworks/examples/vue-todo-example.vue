<template>
  <div class="todo-app">
    <h1>{{ title }}</h1>
    
    <!-- Add new todo -->
    <form @submit.prevent="handleAddTodo">
      <input 
        v-model="newTodoText" 
        placeholder="What needs to be done?"
        autofocus
      />
      <button type="submit" :disabled="!newTodoText.trim()">
        Add
      </button>
    </form>

    <!-- Filter buttons -->
    <div class="filters">
      <button 
        v-for="filter in filters" 
        :key="filter"
        :class="{ active: currentFilter === filter }"
        @click="todo.setFilter(filter)"
      >
        {{ filter }}
      </button>
    </div>

    <!-- Todo list -->
    <ul class="todo-list">
      <li 
        v-for="item in visibleTodos" 
        :key="item.id"
        :class="{ completed: item.completed }"
      >
        <input 
          type="checkbox"
          :checked="item.completed"
          @change="todo.toggle(item.id)"
        />
        <span>{{ item.text }}</span>
        <button @click="todo.remove(item.id)">×</button>
      </li>
    </ul>

    <!-- Stats -->
    <div class="stats" v-if="todos.length > 0">
      <span>{{ activeCount }} {{ activeCount === 1 ? 'item' : 'items' }} left</span>
      <button 
        v-if="completedCount > 0"
        @click="todo.clearCompleted"
      >
        Clear completed
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useComponent, toRef, useComputed } from '@lattice/frameworks/vue';

// Define todo item type
interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

type FilterType = 'all' | 'active' | 'completed';

// Define the Todo component behavior
const Todo = ({ store, computed, set }) => ({
  // State
  todos: store.todos,
  filter: store.filter,
  
  // Computed values
  visibleTodos: computed(() => {
    const todos = store.todos();
    const filter = store.filter();
    
    switch (filter) {
      case 'active':
        return todos.filter(t => !t.completed);
      case 'completed':
        return todos.filter(t => t.completed);
      default:
        return todos;
    }
  }),
  
  activeCount: computed(() => 
    store.todos().filter(t => !t.completed).length
  ),
  
  completedCount: computed(() =>
    store.todos().filter(t => t.completed).length
  ),
  
  // Actions
  add: (text: string) => {
    if (!text.trim()) return;
    
    set(store.todos, todos => [...todos, {
      id: Date.now().toString(),
      text: text.trim(),
      completed: false
    }]);
  },
  
  toggle: (id: string) => {
    set(store.todos, todos =>
      todos.map(t => 
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    );
  },
  
  remove: (id: string) => {
    set(store.todos, todos => todos.filter(t => t.id !== id));
  },
  
  clearCompleted: () => {
    set(store.todos, todos => todos.filter(t => !t.completed));
  },
  
  setFilter: (filter: FilterType) => {
    set(store.filter, filter);
  }
});

// Create component instance
const todo = useComponent(
  { 
    todos: [] as TodoItem[], 
    filter: 'all' as FilterType 
  },
  Todo
);

// Convert signals to Vue refs for template
const todos = toRef(todo.todos);
const visibleTodos = toRef(todo.visibleTodos);
const currentFilter = toRef(todo.filter);
const activeCount = toRef(todo.activeCount);
const completedCount = toRef(todo.completedCount);

// Local Vue state
const newTodoText = ref('');
const title = ref('Todo List');
const filters: FilterType[] = ['all', 'active', 'completed'];

// Handlers
const handleAddTodo = () => {
  todo.add(newTodoText.value);
  newTodoText.value = '';
};
</script>

<style scoped>
.todo-app {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

.filters {
  margin: 20px 0;
  display: flex;
  gap: 10px;
}

.filters button {
  padding: 5px 10px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
}

.filters button.active {
  background: #007bff;
  color: white;
}

.todo-list {
  list-style: none;
  padding: 0;
}

.todo-list li {
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.todo-list li.completed span {
  text-decoration: line-through;
  opacity: 0.6;
}

.stats {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #666;
}
</style>