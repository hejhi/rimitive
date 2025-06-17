# @lattice/adapter-pinia

Pinia adapter for Lattice - wrap existing Pinia stores for use with Lattice components.

## Features

- 🍍 **True adapter pattern** - Wraps any existing Pinia store
- 🛠️ **Preserves all Pinia features** - DevTools, plugins, HMR, getters, actions
- 🔌 **Plugin ecosystem** - Use any Pinia plugin with your stores
- 📦 **Type-safe** - Full TypeScript support with type inference
- 🎯 **Minimal overhead** - Thin wrapper around native Pinia functionality

## Installation

```bash
npm install @lattice/adapter-pinia @lattice/core pinia
# or
pnpm add @lattice/adapter-pinia @lattice/core pinia
```

## Basic Usage

```ts
import { defineStore } from 'pinia';
import { piniaAdapter } from '@lattice/adapter-pinia';

// Create a Pinia store using the native API
const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      this.count++;
    }
  }
});

// Get the store instance
const store = useCounterStore();

// Wrap it with the adapter
const createSlice = piniaAdapter(store);

// Create Lattice components
const counter = createSlice(({ get, set }) => ({
  count: () => get().count,
  increment: () => set({ count: get().count + 1 }),
  decrement: () => set({ count: get().count - 1 }),
  reset: () => set({ count: 0 }),
}));

// Use the component
console.log(counter.selector.count()); // 0
counter.selector.increment();
console.log(counter.selector.count()); // 1

// Native Pinia actions still work
store.increment();
console.log(counter.selector.count()); // 2
```

## Using in Vue Components

```vue
<script setup>
import { computed } from 'vue';
import { defineStore } from 'pinia';
import { piniaAdapter } from '@lattice/adapter-pinia';

// Define your Pinia store
const useAppStore = defineStore('app', {
  state: () => ({
    user: null,
    theme: 'light',
    sidebarOpen: true
  }),
  getters: {
    isLoggedIn: (state) => !!state.user
  }
});

// Create store instance and wrap with adapter
const store = useAppStore();
const createSlice = piniaAdapter(store);

// Create your Lattice components
const ui = createSlice(({ get, set }) => ({
  theme: () => get().theme,
  toggleTheme: () => set({ 
    theme: get().theme === 'light' ? 'dark' : 'light' 
  }),
  toggleSidebar: () => set({ 
    sidebarOpen: !get().sidebarOpen 
  })
}));

// Use in template with computed
const theme = computed(() => ui.selector.theme());
const sidebarOpen = computed(() => store.sidebarOpen); // Can also use native store
</script>

<template>
  <div :class="theme">
    <button @click="ui.selector.toggleTheme">Toggle Theme</button>
    <button @click="ui.selector.toggleSidebar">Toggle Sidebar</button>
  </div>
</template>
```

## Advanced Features

### With Pinia Plugins

```ts
import { createPinia, defineStore } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';
import { piniaAdapter } from '@lattice/adapter-pinia';

// Create Pinia instance with plugins
const pinia = createPinia();
pinia.use(createPersistedState());

// Define store with persistence
const useSettingsStore = defineStore('settings', {
  state: () => ({
    language: 'en',
    notifications: true
  }),
  persist: true // Will be persisted to localStorage
});

// Create store instance with your pinia
const store = useSettingsStore(pinia);

// Wrap with adapter - all plugin features preserved
const createSlice = piniaAdapter(store);
```

### Subscriptions

```ts
// Subscribe to all state changes
const unsubscribe = counter.subscribe(() => {
  console.log('State changed!');
});

// Cleanup when done
unsubscribe();
```

### Multiple Slices from Same Store

```ts
const store = useAppStore();
const createSlice = piniaAdapter(store);

// Create focused slices for different concerns
const auth = createSlice(({ get, set }) => ({
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
  currentUser: () => get().user,
  isAuthenticated: () => !!get().user
}));

const preferences = createSlice(({ get, set }) => ({
  theme: () => get().theme,
  language: () => get().language,
  updatePreferences: (prefs) => set(prefs)
}));
```

## Why Use This Pattern?

1. **Use existing Pinia stores** - No need to rewrite your stores
2. **Preserve Pinia features** - Keep using getters, actions, plugins, devtools
3. **Gradual adoption** - Wrap stores as needed, use Lattice features where beneficial
4. **Type safety** - Full TypeScript support throughout
5. **Framework agnostic components** - Use Lattice components across different frameworks

## API Reference

### `piniaAdapter(store, options?)`

Wraps an existing Pinia store for use with Lattice.

#### Parameters

- `store` - A Pinia store instance
- `options` (optional)
  - `onError` - Custom error handler for subscription errors

#### Returns

A `RuntimeSliceFactory` for creating Lattice slices from the store.

## License

MIT