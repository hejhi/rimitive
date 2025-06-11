# @lattice/adapter-pinia

Pinia adapter for Lattice - integrate Lattice with Vue's official state management library.

## Features

- 🍍 **Pinia integration** - Use Vue's official state management library
- 🛠️ **DevTools support** - Full Vue DevTools integration with time-travel debugging
- 🔌 **Plugin ecosystem** - Access to Pinia's plugin system via enhancer
- 📦 **Type-safe** - Full TypeScript support with type inference
- 🎯 **Global stores** - Create stores that persist across components
- 🔄 **Hot module replacement** - Development experience with HMR support

## Installation

```bash
npm install @lattice/adapter-pinia @lattice/core pinia
# or
pnpm add @lattice/adapter-pinia @lattice/core pinia
```

## Basic Usage

```ts
import { createPiniaAdapter } from '@lattice/adapter-pinia';

// Define your app
const createApp = (createStore) => {
  const createSlice = createStore({ count: 0 });

  const counter = createSlice(({ get, set }) => ({
    count: () => get().count,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
    reset: () => set({ count: 0 }),
  }));

  return { counter };
};

// Create a Lattice store backed by Pinia
const store = createPiniaAdapter(createApp);

// Use the store
console.log(store.counter.count()); // 0
store.counter.increment();
console.log(store.counter.count()); // 1
```

## Using in Vue Components

```vue
<script setup>
import { computed } from 'vue';
import { store } from './store';

const count = computed(() => store.counter.count());
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="store.counter.increment">+</button>
    <button @click="store.counter.decrement">-</button>
    <button @click="store.counter.reset">Reset</button>
  </div>
</template>
```

## Advanced Features

### With Pinia Plugins

Use the enhancer parameter to add Pinia plugins:

```ts
import { createPiniaAdapter } from '@lattice/adapter-pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';

const store = createPiniaAdapter(createApp, (stateCreator, pinia, storeId) => {
  // Add plugins to the Pinia instance
  pinia.use(createPersistedState({
    key: id => `__persisted__${id}`,
    storage: localStorage,
  }));
  
  // Create and return the store
  const useStore = defineStore(storeId, {
    state: stateCreator,
  });
  
  return useStore(pinia);
});
```

### Subscriptions

```ts
// Subscribe to all state changes
const unsubscribe = store.subscribe(() => {
  console.log('State changed!');
});

// Cleanup
unsubscribe();
```

### Vue Composition API Integration

For reactive Vue components, use Vue's composition API:

```vue
<script setup>
import { computed, watchEffect } from 'vue';
import { store } from './store';

// Reactive computed values
const count = computed(() => store.counter.count());
const doubled = computed(() => count.value * 2);

// Watch for changes
watchEffect(() => {
  console.log('Count changed:', count.value);
});
</script>
```

### Using with Pinia's Built-in Composables

Since this creates a real Pinia store, you can use Pinia's composables:

```vue
<script setup>
import { storeToRefs } from 'pinia';
import { store } from './store';

// Note: This requires internal access to the Pinia store
// For most use cases, use computed() as shown above
</script>
```

### Wrapping Existing Pinia Stores

If you have an existing Pinia store, you can wrap it for use with Lattice:

```ts
import { wrapPiniaStore } from '@lattice/adapter-pinia';
import { defineStore } from 'pinia';

// Existing Pinia store
const usePiniaStore = defineStore('myStore', {
  state: () => ({ count: 0 }),
});

const piniaStore = usePiniaStore();
const adapter = wrapPiniaStore(piniaStore);

// Use with createLatticeStore from core
import { createLatticeStore } from '@lattice/core';
const store = createLatticeStore(createApp, adapter);
```

## API Reference

### `createPiniaAdapter(appFactory, enhancer?, options?)`

Creates a Pinia adapter for a Lattice app.

#### Parameters
- `appFactory`: Function that creates your app using Lattice patterns
- `enhancer?`: Optional function to enhance store creation with plugins
- `options?`: Optional configuration
  - `onError?`: Custom error handler for listener errors

#### Returns
A Lattice store backed by Pinia

### `wrapPiniaStore(store, options?)`

Wraps an existing Pinia store as a Lattice adapter.

#### Parameters
- `store`: An existing Pinia store instance
- `options?`: Optional configuration

#### Returns
A minimal store adapter

### `createStoreAdapter(store, options?)`

Creates a minimal adapter from a Pinia store (internal utility).

## TypeScript

Full TypeScript support with automatic type inference:

```ts
const createApp = (createStore) => {
  const createSlice = createStore({ 
    user: null as { name: string; email: string } | null,
    isLoggedIn: false 
  });
  
  const auth = createSlice(({ get, set }) => ({
    login: (name: string, email: string) => {
      set({ user: { name, email }, isLoggedIn: true });
    },
    logout: () => {
      set({ user: null, isLoggedIn: false });
    },
    currentUser: () => get().user,
    isAuthenticated: () => get().isLoggedIn,
  }));
  
  return { auth };
};

const store = createPiniaAdapter(createApp);
// TypeScript knows all the types!
```

## DevTools Integration

All Lattice stores created with the Pinia adapter automatically appear in Vue DevTools with:
- State inspection
- Action tracking
- Time-travel debugging
- State export/import

## Cross-Framework Support

### React Support

While Pinia is Vue-specific, you can still use Lattice stores created with this adapter in React applications via the React hooks from `@lattice/runtime/react`:

```tsx
// In a separate file that imports the React hooks
import { useSlice, useSliceSelector } from '@lattice/runtime/react';
import { store } from './store';

function Counter() {
  const counter = useSlice(store.counter);
  const count = useSliceSelector(store.counter, c => c.count());
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={counter.increment}>+</button>
    </div>
  );
}
```

**Note**: This creates a Pinia instance even in React apps. For React-only projects, consider using `@lattice/adapter-zustand` or `@lattice/adapter-redux` instead.

## License

MIT