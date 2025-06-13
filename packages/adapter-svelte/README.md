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

The recommended approach is to use the runtime utilities from `@lattice/runtime/svelte` for idiomatic Svelte patterns:

```svelte
<script>
  import { sliceValue, sliceValues } from '@lattice/runtime/svelte';
  import { store } from './store';
  
  // Use sliceValue for single values - creates reactive Svelte stores
  const count = sliceValue(store, s => s.counter.value());
  const user = sliceValue(store, s => s.auth.user());
  
  // Or use sliceValues for multiple values at once
  const values = sliceValues(store, {
    count: s => s.counter.value(),
    user: s => s.auth.user(),
    isLoggedIn: s => !!s.auth.user()
  });
</script>

<!-- Using individual stores -->
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

<!-- Or using the values object -->
<div>
  <p>Count: {$values.count}</p>
  {#if $values.isLoggedIn}
    <p>Logged in as: {$values.user.name}</p>
  {/if}
</div>
```

### Complex Selectors with Derived Values

For computed values that combine multiple slices, use `derivedSlice`:

```svelte
<script>
  import { derivedSlice } from '@lattice/runtime/svelte';
  import { store } from './store';
  
  // Create derived values that update automatically
  const summary = derivedSlice(store, s => ({
    itemCount: s.cart.items().length,
    totalPrice: s.cart.total(),
    userName: s.auth.user()?.name ?? 'Guest',
    formattedTotal: `$${s.cart.total().toFixed(2)}`
  }));
</script>

<div class="cart-summary">
  <h3>{$summary.userName}'s Cart</h3>
  <p>{$summary.itemCount} items</p>
  <p>Total: {$summary.formattedTotal}</p>
</div>
```

## Integration with Svelte Stores

### Using with Existing Stores

You can wrap existing Svelte stores to use with Lattice:

```typescript
import { writable } from 'svelte/store';
import { wrapSvelteStore, createLatticeStore } from '@lattice/adapter-svelte';

// Existing Svelte store
const myStore = writable({ count: 0, theme: 'light' });

// Wrap for Lattice
const adapter = wrapSvelteStore(myStore);
const store = createLatticeStore(createComponent, () => adapter);

// Important: Clean up when done to prevent memory leaks
onDestroy(() => {
  adapter.destroy();
});
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

// The persisted store continues to work as expected
// State is automatically saved to localStorage
```

### Memory Management

The adapter now includes proper cleanup to prevent memory leaks:

```typescript
// When using createSvelteAdapter
const store = createSvelteAdapter(createComponent);

// Clean up when component is destroyed
onDestroy(() => {
  store.destroy();
});
```

## Svelte 5 Compatibility

This adapter uses Svelte's stable stores API, which works across both Svelte 4 and Svelte 5. While Svelte 5 introduces runes, stores remain fully supported and are the recommended approach for complex state management scenarios.

### Using with Svelte 5 Runes

The runtime utilities work seamlessly with Svelte 5. For advanced use cases, you can combine runes with Lattice stores:

```svelte
<script>
  import { sliceValue } from '@lattice/runtime/svelte';
  import { store } from './store';
  
  // Runtime utilities work perfectly with Svelte 5
  const count = sliceValue(store, s => s.counter.value());
  
  // You can still use runes for local state
  let localMultiplier = $state(2);
  
  // Combine store state with local state
  const multiplied = $derived($count * localMultiplier);
</script>

<button onclick={() => store.counter.increment()}>
  Count: {$count} × {localMultiplier} = {multiplied}
</button>

<input type="number" bind:value={localMultiplier} />
```

## TypeScript Support

Full TypeScript support with type inference:

```typescript
interface Todo {
  id: number;
  text: string;
  done: boolean;
}

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

// Usage in Svelte with full type safety
const store = createSvelteAdapter(createComponent);
const todos = sliceValue(store, s => s.todos.filtered()); // Type: Readable<Todo[]>
```

## Why Use This Adapter?

1. **Native Svelte Integration**: Uses Svelte's built-in stores, no external dependencies
2. **Server-Side Rendering**: Full SSR support out of the box
3. **DevTools Support**: Works with Svelte DevTools for debugging
4. **Portable Logic**: Share business logic with React, Vue, or vanilla JS apps
5. **Type Safety**: Complete TypeScript support with inference

## Performance

The adapter is optimized for Svelte's reactivity model:
- Thin wrapper around native Svelte stores
- State caching to minimize `get()` calls
- Efficient subscription management with proper cleanup
- No additional re-renders - works with Svelte's fine-grained reactivity
- Memory leak prevention with destroy() lifecycle method

## License

MIT