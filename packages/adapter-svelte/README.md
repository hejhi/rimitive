# @lattice/adapter-svelte

Svelte stores adapter for Lattice - use Lattice's portable components with Svelte's built-in state management.

## Installation

```bash
npm install @lattice/adapter-svelte @lattice/core
```

## Usage

### Basic Example

```typescript
import { createSvelteAdapter } from '@lattice/adapter-svelte';

// Define your component
const createComponent = (createStore) => {
  const createSlice = createStore({ count: 0, user: null });
  
  const counter = createSlice(({ get, set }) => ({
    value: () => get().count,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 })
  }));
  
  const auth = createSlice(({ get, set }) => ({
    user: () => get().user,
    login: (user) => set({ user }),
    logout: () => set({ user: null })
  }));
  
  return { counter, auth };
};

// Create the store
const store = createSvelteAdapter(createComponent);
```

### Using in Svelte Components

```svelte
<script>
  import { derived } from 'svelte/store';
  import { store } from './store';
  
  // Create reactive derived stores for values
  const count = derived(store, $store => store.counter.value());
  const user = derived(store, $store => store.auth.user());
</script>

{#if $user}
  <p>Welcome, {$user.name}!</p>
  <button on:click={store.auth.logout}>Logout</button>
{:else}
  <button on:click={() => store.auth.login({ name: 'Alice' })}>
    Login as Alice
  </button>
{/if}

<div>
  <p>Count: {$count}</p>
  <button on:click={store.counter.increment}>+</button>
  <button on:click={store.counter.decrement}>-</button>
</div>
```

### Alternative: Direct Subscription Pattern

For simple cases, you can also use Svelte's reactive statements:

```svelte
<script>
  import { store } from './store';
  
  let count = store.counter.value();
  let user = store.auth.user();
  
  // Subscribe to changes
  store.subscribe(() => {
    count = store.counter.value();
    user = store.auth.user();
  });
</script>
```

## Integration with Svelte Stores

### Using with Existing Stores

You can wrap existing Svelte stores to use with Lattice:

```typescript
import { writable } from 'svelte/store';
import { wrapSvelteStore } from '@lattice/adapter-svelte';

// Existing Svelte store
const myStore = writable({ count: 0, theme: 'light' });

// Wrap for Lattice
const adapter = wrapSvelteStore(myStore);
const store = createLatticeStore(createComponent, () => adapter);
```

### Using with Persisted Stores

Works great with persisted store libraries:

```typescript
import { persisted } from 'svelte-persisted-store';
import { wrapSvelteStore } from '@lattice/adapter-svelte';

// Create persisted store
const persistedStore = persisted('app-state', { count: 0 });

// Use with Lattice
const adapter = wrapSvelteStore(persistedStore);
```

## Svelte 5 Compatibility

This adapter uses Svelte's stable stores API, which works across both Svelte 4 and Svelte 5. While Svelte 5 introduces runes, stores remain fully supported and are the recommended approach for complex state management scenarios.

### Using with Svelte 5 Runes

You can combine Lattice stores with Svelte 5's rune syntax:

```svelte
<script>
  import { store } from './store';
  
  // Use $state rune with Lattice values
  let count = $state(store.counter.value());
  let user = $state(store.auth.user());
  
  // Update local state when store changes
  $effect(() => {
    store.subscribe(() => {
      count = store.counter.value();
      user = store.auth.user();
    });
  });
</script>

<button onclick={() => store.counter.increment()}>
  Count: {count}
</button>
```

## TypeScript Support

Full TypeScript support with type inference:

```typescript
const createComponent = (createStore: CreateStore<{
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
}>) => {
  const createSlice = createStore({ todos: [], filter: 'all' });
  
  const todos = createSlice(({ get, set }) => ({
    add: (text: string) => {
      const newTodo: Todo = { id: Date.now(), text, done: false };
      set({ todos: [...get().todos, newTodo] });
    },
    toggle: (id: number) => {
      set({
        todos: get().todos.map(t => 
          t.id === id ? { ...t, done: !t.done } : t
        )
      });
    },
    filtered: () => {
      const todos = get().todos;
      const filter = get().filter;
      
      switch (filter) {
        case 'active': return todos.filter(t => !t.done);
        case 'completed': return todos.filter(t => t.done);
        default: return todos;
      }
    }
  }));
  
  return { todos };
};
```

## Why Use This Adapter?

1. **Native Svelte Integration**: Uses Svelte's built-in stores, no external dependencies
2. **Server-Side Rendering**: Full SSR support out of the box
3. **DevTools Support**: Works with Svelte DevTools for debugging
4. **Portable Logic**: Share business logic with React, Vue, or vanilla JS apps
5. **Type Safety**: Complete TypeScript support with inference

## Performance

The adapter adds minimal overhead:
- Thin wrapper around native Svelte stores
- Efficient subscription management
- No additional re-renders

## License

MIT