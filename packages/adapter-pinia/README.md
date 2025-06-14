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

// Define your component
const createComponent = (createStore) => {
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
const store = createPiniaAdapter(createComponent);

// Use the store
console.log(store.counter.selector.count()); // 0
store.counter.selector.increment();
console.log(store.counter.selector.count()); // 1
```

## Using in Vue Components

```vue
<script setup>
import { computed } from 'vue';
import { store } from './store';

const count = computed(() => store.counter.selector.count());
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="store.counter.selector.increment">+</button>
    <button @click="store.counter.selector.decrement">-</button>
    <button @click="store.counter.selector.reset">Reset</button>
  </div>
</template>
```

## Advanced Features

### With Pinia Plugins

Use the enhancer parameter to add Pinia plugins:

```ts
import { createPiniaAdapter } from '@lattice/adapter-pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';

const store = createPiniaAdapter(createComponent, (stateCreator, pinia, storeId) => {
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

### Vue Composables

The adapter includes Vue composables that integrate seamlessly with Vue's reactivity system:

```vue
<script setup>
import { useSliceSelector, useSliceValues } from '@lattice/runtime/vue';
import { store } from './store';

// Subscribe to a single value
const count = useSliceSelector(store.counter, c => c.selector.count());

// Subscribe to multiple values
const { user, isLoggedIn } = useSliceValues(store.auth, a => ({
  user: a.selector.currentUser(),
  isLoggedIn: a.selector.isAuthenticated()
}));

// Get both slice methods and reactive values
const [counter, { count: countRef, doubled }] = useLattice(
  store.counter,
  c => ({ count: c.selector.count(), doubled: c.selector.doubled() })
);
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Doubled: {{ doubled }}</p>
    <button @click="counter.selector.increment">+</button>
    
    <div v-if="isLoggedIn">
      Welcome, {{ user.name }}!
    </div>
  </div>
</template>
```

### Direct Composition API Usage

You can also use Vue's built-in composition API directly:

```vue
<script setup>
import { computed, watchEffect } from 'vue';
import { store } from './store';

// Reactive computed values
const count = computed(() => store.counter.selector.count());

// Watch for changes
watchEffect(() => {
  console.log('Count changed:', count.value);
});
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
const store = createLatticeStore(createComponent, adapter);
```

## API Reference

### `createPiniaAdapter(componentFactory, enhancer?, options?)`

Creates a Pinia adapter for a Lattice component.

#### Parameters
- `componentFactory`: Function that creates your component using Lattice patterns
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

### Vue Composables

Vue composables are provided by `@lattice/runtime/vue` and work with any Lattice adapter:

- `useSliceSelector` - Subscribe to specific values with reactive updates
- `useSlice` - Access a single slice directly
- `useSliceValues` - Subscribe to multiple values with destructuring support
- `useLattice` - Get both slice methods and reactive values

See the [@lattice/runtime documentation](https://github.com/hivvy/lattice/tree/main/packages/runtime#vue-composables) for full API details.

## TypeScript

Full TypeScript support with automatic type inference:

```ts
const createComponent = (createStore) => {
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

const store = createPiniaAdapter(createComponent);
// TypeScript knows all the types!
```

## DevTools Integration

All Lattice stores created with the Pinia adapter automatically appear in Vue DevTools with:
- State inspection
- Action tracking
- Time-travel debugging
- State export/import

## License

MIT