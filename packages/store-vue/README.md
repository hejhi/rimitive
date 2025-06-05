# @lattice/store-vue

Lightweight state store for Vue 3 - create reactive stores using Vue's Composition API with shallow reactivity for optimal performance.

## Features

- 🎯 **Vue 3 Composition API** - Native integration with Vue's Composition API
- ⚡ **Shallow reactivity** - Optimized performance for large state objects
- 🔄 **Auto-memoization** - Computed views cache results automatically
- 📦 **Type-safe** - Full TypeScript support with type inference
- 🛠️ **DevTools compatible** - Works with Vue DevTools
- 🌊 **SSR-friendly** - Proper hydration support
- 🎨 **Multiple patterns** - Composables, provide/inject, and global stores

## Installation

```bash
npm install @lattice/store-vue
# or
pnpm add @lattice/store-vue
```

## Basic Usage

### Using the `useLattice` composable

```vue
<script setup>
import { useLattice } from '@lattice/store-vue';
import { createComponent, createModel, createSlice } from '@lattice/core';
import { computed } from 'vue';

// Define your component
const counterComponent = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
  }));

  const actions = createSlice(model, m => ({
    increment: m.increment,
    decrement: m.decrement,
  }));

  const views = {
    count: createSlice(model, m => ({ value: m.count })),
  };

  return { model, actions, views };
});

// Use in your Vue component
const store = useLattice(counterComponent);
const count = computed(() => store.views.count().value);
</script>

<template>
  <div>
    <h1>Count: {{ count }}</h1>
    <button @click="store.actions.increment">+</button>
    <button @click="store.actions.decrement">-</button>
  </div>
</template>
```

### Using Provide/Inject Pattern

```vue
<!-- Parent.vue -->
<script setup>
import { provideLattice } from '@lattice/store-vue';
import { todoComponent } from './todo-component';

// Provide store to all children
const store = provideLattice(todoComponent);
</script>

<template>
  <div>
    <TodoList />
    <AddTodoForm />
  </div>
</template>

<!-- Child.vue -->
<script setup>
import { useLatticeStore } from '@lattice/store-vue';
import { computed } from 'vue';

const store = useLatticeStore();
const todos = computed(() => store.views.todos());
</script>

<template>
  <ul>
    <li v-for="todo in todos" :key="todo.id">
      <input
        type="checkbox"
        :checked="todo.done"
        @change="store.actions.toggleTodo(todo.id)"
      />
      {{ todo.text }}
    </li>
  </ul>
</template>
```

### Global Store Pattern

```ts
// stores/todo.ts
import { createVueAdapter } from '@lattice/store-vue';
import { createComponent, createModel, createSlice } from '@lattice/core';

const todoComponent = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    todos: [],
    addTodo: (text) => {
      const newTodo = {
        id: Date.now(),
        text,
        done: false,
      };
      set({ todos: [...get().todos, newTodo] });
    },
    toggleTodo: (id) => {
      set({
        todos: get().todos.map(todo =>
          todo.id === id ? { ...todo, done: !todo.done } : todo
        ),
      });
    },
  }));

  const actions = createSlice(model, m => ({
    addTodo: m.addTodo,
    toggleTodo: m.toggleTodo,
  }));

  const views = {
    todos: createSlice(model, m => m.todos),
    activeTodos: createSlice(model, m => m.todos.filter(t => !t.done)),
    completedTodos: createSlice(model, m => m.todos.filter(t => t.done)),
  };

  return { model, actions, views };
});

// Export global store
export const todoStore = createVueAdapter(todoComponent);
```

```vue
<!-- Component.vue -->
<script setup>
import { computed } from 'vue';
import { todoStore } from './stores/todo';

// Use global store
const todos = computed(() => todoStore.views.todos());
const activeCount = computed(() => todoStore.views.activeTodos().length);
</script>

<template>
  <div>
    <h2>Todos ({{ activeCount }} active)</h2>
    <ul>
      <li v-for="todo in todos" :key="todo.id">
        {{ todo.text }}
      </li>
    </ul>
  </div>
</template>
```

## Vue-Specific Features

### Automatic Dependency Tracking

Vue's reactivity system automatically tracks dependencies:

```vue
<script setup>
const store = useLattice(appComponent);

// This computed will only update when todos or filter changes
const filteredTodos = computed(() => {
  const todos = store.views.todos();
  const filter = store.views.filter();
  
  return filter === 'all' 
    ? todos 
    : todos.filter(t => filter === 'active' ? !t.done : t.done);
});
</script>
```

### Integration with Vue DevTools

The adapter integrates with Vue DevTools, allowing you to inspect:
- Reactive state changes
- Computed property dependencies
- Component store relationships

### Watchers and Effects

Use Vue's `watch` and `watchEffect` with Lattice stores:

```vue
<script setup>
import { watch, watchEffect } from 'vue';

const store = useLattice(component);

// Watch specific view
watch(
  () => store.views.count(),
  (newCount, oldCount) => {
    console.log(`Count changed from ${oldCount} to ${newCount}`);
  }
);

// Watch with effect
watchEffect(() => {
  document.title = `Todos (${store.views.activeTodos().length})`;
});
</script>
```

### Using with Vue Router

```vue
<script setup>
import { useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute();
const store = useLattice(appComponent);

// Sync route params with store
const userId = computed(() => route.params.userId);

watch(userId, (id) => {
  store.actions.loadUser(id);
});
</script>
```

## Advanced Patterns

### Composing Multiple Stores

```vue
<script setup>
import { useLattice } from '@lattice/store-vue';
import { computed } from 'vue';

const userStore = useLattice(userComponent);
const cartStore = useLattice(cartComponent);

// Compose data from multiple stores
const orderSummary = computed(() => ({
  user: userStore.views.currentUser(),
  items: cartStore.views.items(),
  total: cartStore.views.total(),
}));
</script>
```

### Custom Composables

Create reusable composables with Lattice:

```ts
// composables/useTodos.ts
import { computed, ref } from 'vue';
import { useLattice } from '@lattice/store-vue';
import { todoComponent } from '../components/todo';

export function useTodos() {
  const store = useLattice(todoComponent);
  const searchQuery = ref('');

  const filteredTodos = computed(() => {
    const todos = store.views.todos();
    const query = searchQuery.value.toLowerCase();
    
    return query
      ? todos.filter(t => t.text.toLowerCase().includes(query))
      : todos;
  });

  return {
    todos: computed(() => store.views.todos()),
    filteredTodos,
    searchQuery,
    actions: store.actions,
  };
}
```

### Server-Side Rendering (SSR)

The adapter supports SSR with Nuxt or custom Vue SSR setups:

```ts
// server.ts
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createVueAdapter } from '@lattice/store-vue';

const app = createSSRApp(App);

// Create and provide store on server
const store = createVueAdapter(appComponent);
app.provide(LatticeKey, store);

const html = await renderToString(app);
```

## Plugin Installation

For app-wide stores, use the Vue plugin:

```ts
// main.ts
import { createApp } from 'vue';
import { LatticePlugin } from '@lattice/store-vue';
import { appComponent } from './components/app';

const app = createApp(App);

app.use(LatticePlugin, {
  component: appComponent,
  // Optional: custom injection key
  key: Symbol('myApp')
});
```

## Performance Considerations

### Computed Caching

Vue automatically caches computed values:

```vue
<script setup>
const store = useLattice(component);

// This is cached and only recomputes when dependencies change
const expensiveView = computed(() => {
  const data = store.views.largeDataset();
  return processExpensiveComputation(data);
});
</script>
```

### Shallow Reactivity for Performance

The adapter uses `shallowRef` for optimal performance:
- Only top-level state changes trigger updates
- Predictable performance with large data sets
- Encourages immutable update patterns
- Leverages Vue's efficient reactivity system

### Store Cleanup

The adapter automatically cleans up when components are unmounted. However, for global stores or manual cleanup needs:

```typescript
// Global store
const globalStore = createVueAdapter(component);

// Manual cleanup when needed
globalStore.destroy();

// Component-scoped store (auto-cleanup on unmount)
const store = useLattice(component);
// No manual cleanup needed - handled by Vue's lifecycle
```

When to use `destroy()`:
- Global stores that need to be disposed
- Temporary stores created outside components
- Testing scenarios requiring cleanup
- Before recreating a store with the same data

## API Reference

### `useLattice(component)`

Creates a reactive Lattice store using Vue's Composition API.

**Parameters:**
- `component`: A Lattice component spec or factory

**Returns:**
- `AdapterResult` with `actions`, `views`, `subscribe`, and `getState`

### `provideLattice(component, key?)`

Provides a Lattice store to child components.

**Parameters:**
- `component`: A Lattice component spec or factory
- `key`: Optional injection key (defaults to `LatticeKey`)

**Returns:**
- The created store instance

### `useLatticeStore(key?)`

Injects a Lattice store from a parent component.

**Parameters:**
- `key`: Optional injection key (defaults to `LatticeKey`)

**Returns:**
- The injected store instance

### `createVueAdapter(component)`

Creates a global Lattice store outside of components.

**Parameters:**
- `component`: A Lattice component spec or factory

**Returns:**
- `AdapterResult` with full store functionality

## TypeScript Support

Full TypeScript support with type inference:

```ts
import { useLattice } from '@lattice/store-vue';
import type { TodoModel, TodoActions, TodoViews } from './types';

const store = useLattice<TodoModel, TodoActions, TodoViews>(todoComponent);

// TypeScript knows all types
store.actions.addTodo('New todo'); // ✅ Type-safe
store.views.todos(); // ✅ Returns Todo[]
```

## Comparison with Other Adapters

| Feature | Vue Adapter | React Adapter | Zustand Adapter |
|---------|-------------|---------------|-----------------|
| Reactivity | Vue's reactive system | React hooks | Zustand subscriptions |
| Dependency tracking | Automatic | Manual | Manual |
| Computed caching | Built-in | Manual memoization | N/A |
| DevTools | Vue DevTools | React DevTools | Redux DevTools |
| Bundle size | ~3KB (Vue excluded) | 0KB | ~8KB |
| SSR support | Native | Yes | Yes |

## License

MIT