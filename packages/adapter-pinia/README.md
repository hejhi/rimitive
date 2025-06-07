# @lattice/adapter-pinia

Pinia adapter for Lattice - integrate Lattice components with Vue's official state management library.

## Features

- 🍍 **Pinia integration** - Use Vue's official state management library
- 🛠️ **DevTools support** - Full Vue DevTools integration with time-travel debugging
- 🔌 **Plugin ecosystem** - Access to Pinia's plugin system
- 📦 **Type-safe** - Full TypeScript support with type inference
- 🎯 **Global stores** - Create stores that persist across components
- 🔄 **Hot module replacement** - Development experience with HMR support

## Installation

```bash
npm install @lattice/adapter-pinia pinia
# or
pnpm add @lattice/adapter-pinia pinia
```

## Basic Usage

### Setup Pinia

First, make sure Pinia is installed in your Vue app:

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
```

### Using the `createPiniaAdapter`

```ts
import { createPiniaAdapter } from '@lattice/adapter-pinia';
import { createModel, createSlice } from '@lattice/core';

// Define your component
const counterComponent = () => {
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
    doubled: createSlice(model, m => ({ value: m.count * 2 })),
  };

  return { model, actions, views };
};

// Create a Pinia store
export const useCounterStore = createPiniaAdapter(counterComponent, 'counter');
```

### Using in components

```vue
<script setup>
import { useCounterStore } from './stores/counter';
import { computed } from 'vue';

const store = useCounterStore();
const count = computed(() => store.views.count().value);
const doubled = computed(() => store.views.doubled().value);
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Doubled: {{ doubled }}</p>
    <button @click="store.actions.increment">+</button>
    <button @click="store.actions.decrement">-</button>
  </div>
</template>
```

## Advanced Features

### Subscriptions

```ts
const store = useCounterStore();

// Subscribe to specific views
const unsubscribe = store.subscribe(
  views => views.count(),
  count => console.log('Count changed:', count.value)
);

// Cleanup
unsubscribe();
```

### Store Management

Pinia handles store singleton behavior internally - multiple calls to create a store with the same ID will return the same store instance. This ensures consistent state management across your application.

### With Pinia plugins

```ts
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

// Your Lattice stores will automatically benefit from plugins
```

### DevTools Integration

All Lattice stores created with the Pinia adapter automatically appear in Vue DevTools with:
- State inspection
- Action tracking
- Time-travel debugging
- State export/import

## API

### `createPiniaAdapter(component, storeId)`

Creates a Pinia store from a Lattice component.

#### Parameters
- `component`: A Lattice component specification
- `storeId`: Unique identifier for the Pinia store

#### Returns
A function that returns the store instance (following Pinia's `defineStore` pattern)

## Comparison with @lattice/store-vue

| Feature | @lattice/adapter-pinia | @lattice/store-vue |
|---------|------------------------|-------------------|
| Dependencies | Requires Pinia | Zero dependencies |
| DevTools | Full Pinia DevTools | Basic Vue DevTools |
| Scope | Global stores | Component-scoped |
| Plugins | Pinia plugin ecosystem | None |
| Bundle size | Larger (includes Pinia) | Minimal |
| HMR | Built-in support | Manual setup |

Choose `@lattice/adapter-pinia` when you need:
- Global state management
- DevTools with time-travel debugging
- Plugin features (persistence, sync, etc.)
- Existing Pinia ecosystem

Choose `@lattice/store-vue` when you need:
- Minimal bundle size
- Component-scoped stores
- Zero dependencies
- Simple use cases