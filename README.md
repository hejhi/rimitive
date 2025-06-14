# Lattice

A framework for building composable, headless UI components that work across any JavaScript framework.

## The Core Problem: Reusable UI Behavior

Building truly reusable UI components is hard. When you create a dropdown component, you're actually building two things: the behavior (keyboard navigation, focus management, state) and the visual presentation. Current solutions force you to either:

- **Choose a framework** and lock out other users
- **Write vanilla JavaScript** and lose reactivity  
- **Maintain multiple versions** for different frameworks
- **Use inheritance** which creates fragile base classes and doesn't compose well

This gets worse when you want to share behavior across components. The same focus trap logic needed for a modal is also needed for a dropdown and a popover, but there's no good way to share this without coupling to a specific framework or using complex inheritance patterns.

## What Lattice Does

Lattice lets you write UI behavior as composable functions that work with any framework. Instead of inheriting from base classes or coupling to specific frameworks, you compose behaviors from simple primitives: `get`, `set`, and `subscribe`.

This enables you to:
- Write a modal's focus trap behavior once and use it in React, Vue, Svelte, or vanilla JS
- Compose complex behaviors from simpler ones (combine keyboard navigation + focus management + animations)
- Share behavioral patterns across different components without inheritance
- Keep behaviors framework-agnostic while maintaining full type safety

```typescript
// Define a headless dropdown behavior
const createDropdown = (createStore) => {
  const createSlice = createStore({ 
    isOpen: false,
    selectedIndex: -1,
    items: []
  });
  
  const dropdown = createSlice(({ get, set }) => ({
    // State
    isOpen: () => get().isOpen,
    selectedIndex: () => get().selectedIndex,
    
    // Actions
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false, selectedIndex: -1 }),
    toggle: () => set({ isOpen: !get().isOpen }),
    
    // Keyboard navigation
    selectNext: () => {
      const { selectedIndex, items } = get();
      set({ selectedIndex: Math.min(selectedIndex + 1, items.length - 1) });
    },
    selectPrevious: () => {
      const { selectedIndex } = get();
      set({ selectedIndex: Math.max(selectedIndex - 1, -1) });
    },
    
    // Item management
    setItems: (items) => set({ items }),
    selectItem: (index) => {
      set({ selectedIndex: index, isOpen: false });
      // Trigger selection callback if needed
    }
  }));
  
  return { dropdown };
};

// Use the same behavior across different frameworks
const reactStore = createStoreReactAdapter(createDropdown);   // For React components
const vueStore = createPiniaAdapter(createDropdown);           // For Vue components
const svelteStore = createSvelteAdapter(createDropdown);       // For Svelte components
```

## Key Benefits

### True Behavioral Composition
Unlike class-based inheritance, Lattice enables functional composition of behaviors. You can combine keyboard navigation from one package, focus management from another, and your custom logic - all without worrying about inheritance chains or method overrides.

```typescript
// Compose behaviors without inheritance issues
const accessibleDropdown = createSlice(
  compose({ dropdown, focusTrap, announcements }, 
    (tools, { dropdown, focusTrap, announcements }) => ({
      open: () => {
        dropdown.open();
        focusTrap.activate();
        announcements.announce('Dropdown opened');
      }
    })
  )
);
```

### Context-Scoped State Without Performance Issues
Unlike React Context (which triggers re-renders for all consumers) or global stores (which don't provide isolation), Lattice gives you tree-scoped state with surgical updates. Perfect for headless components that need isolated instances.

### Write Once, Use Anywhere
Write your dropdown behavior once and use it in:
- React with hooks
- Vue with composition API  
- Svelte with stores
- Vanilla JS with direct subscriptions
- Web Components
- Even server-rendered frameworks with appropriate adapters

### Can't Lose Essential Behavior
When composing behaviors, you explicitly include what you need. Unlike inheritance where overriding methods can accidentally break functionality, composition ensures essential behaviors remain intact.

## Real-World Use Cases

**Headless Component Libraries**: Build truly framework-agnostic UI components. Write the behavior for modals, dropdowns, and tooltips once, ship to all frameworks.

**Design System Components**: Share the same behavioral specifications across your React web app, React Native mobile app, and Vue marketing site.

**Accessibility Patterns**: Create reusable accessibility behaviors (focus trapping, screen reader announcements, keyboard navigation) that can be composed into any component.

**Complex UI Interactions**: Build sophisticated behaviors like drag-and-drop, infinite scrolling, or data grids as composable units that work everywhere.

**Cross-Team Collaboration**: Frontend teams using different frameworks can share and compose behavioral components without coordination overhead.

## Core Concepts

### Behavior as Specification
Behaviors are defined as pure functions that receive `get` and `set` primitives. This simple contract works with any reactive system:

```typescript
const dropdown = createSlice(({ get, set }) => ({
  // Pure functions that describe behavior
  isOpen: () => get().isOpen,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen })
}));
```

### Composition Over Inheritance
Instead of extending base classes, you compose behaviors functionally:

```typescript
// Don't do this - fragile inheritance
class AccessibleDropdown extends Dropdown {
  open() {
    super.open(); // What if parent changes?
    this.focusTrap.activate();
  }
}

// Do this - explicit composition
const accessibleDropdown = createSlice(
  compose({ dropdown, focusTrap }, (tools, deps) => ({
    open: () => {
      deps.dropdown.open();
      deps.focusTrap.activate();
    }
  }))
);
```

### Behavioral Building Blocks
Complex components are built by composing simple, focused behaviors:

```typescript
// Composable behavioral units
const toggleable = createSlice(/* toggle behavior */);
const selectable = createSlice(/* selection behavior */);
const navigable = createSlice(/* keyboard navigation */);
const focusable = createSlice(/* focus management */);

// Compose into a full dropdown
const dropdown = createSlice(
  compose({ toggleable, selectable, navigable, focusable }, 
    /* combine behaviors */)
);
```

## Type Safety Examples

Lattice provides full TypeScript inference throughout your application:

```typescript
// Type-safe state definition
type AppState = {
  user: { id: string; name: string } | null;
  items: Array<{ id: string; price: number }>;
  settings: { theme: 'light' | 'dark' };
};

const createComponent = (createStore: CreateStore<AppState>) => {
  // TypeScript infers state shape automatically
  const createSlice = createStore({
    user: null,
    items: [],
    settings: { theme: 'light' }
  });

  // Methods are fully typed with parameter and return types
  const user = createSlice(({ get, set }) => ({
    current: () => get().user, // Return type: { id: string; name: string } | null
    login: (id: string, name: string) => set({ user: { id, name } }),
    logout: () => set({ user: null })
  }));

  // TypeScript catches errors at compile time
  const cart = createSlice(({ get, set }) => ({
    addItem: (id: string, price: number) => {
      // TypeScript knows 'items' is an array of { id: string; price: number }
      set({ items: [...get().items, { id, price }] });
    },
    // This would cause a TypeScript error:
    // set({ items: [...get().items, { id, cost: price }] }); // Error: 'cost' doesn't exist
  }));

  return { user, cart };
};

// Type inference flows through to React components
function UserProfile() {
  // TypeScript knows todos is an array of { id: string; price: number }
  const items = useSliceSelector(store, s => s.cart.items());
  
  // TypeScript knows user is { id: string; name: string } | null
  const user = useSliceSelector(store, s => s.user.current());
  
  if (!user) return <div>Please log in</div>;
  
  // TypeScript knows user is non-null here
  return <div>Welcome, {user.name}!</div>;
}
```

## Architecture

```
┌─────────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Headless Components │────▶│ Lattice Core │────▶│ Adapters        │
│ (Behavioral Specs)  │     │ (get, set,   │     │ (React, Vue,    │
│                     │     │  subscribe)  │     │  Svelte, etc)   │
└─────────────────────┘     └──────────────┘     └─────────────────┘
         │                          │                     │
         │                          │                     ▼
         │                          │            ┌──────────────────┐
         │                          │            │ UI Frameworks    │
         ▼                          │            │ • React hooks    │
┌─────────────────────┐             │            │ • Vue composable │
│ Composition         │             │            │ • Svelte stores  │
│ • Keyboard nav      │             │            │ • Vanilla JS     │
│ • Focus management  │             │            └──────────────────┘
│ • Accessibility     │             │
│ • Custom behaviors  │             │
└─────────────────────┘             │
         │                          │
         └──────────────────────────┘
                  compose()
```

## Installation

```bash
# Core
npm install @lattice/core

# Choose your adapter
npm install @lattice/adapter-redux    # For Redux
npm install @lattice/adapter-zustand   # For Zustand
npm install @lattice/adapter-pinia     # For Pinia
npm install @lattice/adapter-svelte    # For Svelte

# Framework integration (optional)
npm install @lattice/runtime          # For React/Vue/Svelte hooks
```

## Quick Start

```typescript
// 1. Define a headless modal behavior
import { compose } from '@lattice/core';
import { createStoreReactAdapter } from '@lattice/adapter-store-react';
import { useSliceSelector } from '@lattice/runtime/react';

const createModal = (createStore) => {
  const createSlice = createStore({ 
    isOpen: false,
    content: null,
    trapped: false 
  });
  
  const modal = createSlice(({ get, set }) => ({
    // State
    isOpen: () => get().isOpen,
    content: () => get().content,
    
    // Actions
    open: (content = null) => set({ isOpen: true, content }),
    close: () => set({ isOpen: false, content: null })
  }));
  
  // Compose with focus trap behavior
  const focusTrap = createSlice(({ get, set }) => ({
    trapped: () => get().trapped,
    trap: () => set({ trapped: true }), /* focus trap implementation */
    release: () => set({ trapped: false }) /* release implementation */
  }));
  
  // Combine behaviors
  const accessibleModal = createSlice(
    compose({ modal, focusTrap }, (_, { modal, focusTrap }) => ({
      open: (content) => {
        modal.open(content);
        focusTrap.trap();
      },
      close: () => {
        focusTrap.release();
        modal.close();
      }
    }))
  );
  
  return { modal: accessibleModal };
};

// 2. Use the same behavior in React
const store = createStoreReactAdapter(createModal);

function Modal() {
  const isOpen = useSliceSelector(store, s => s.modal.isOpen());
  const close = () => store.modal.selector.close();
  
  if (!isOpen) return null;
  return <div role="dialog">...</div>;
}

// 3. Or use it in Vue with a different adapter
const vueStore = createPiniaAdapter(createModal);
// Now use with Vue's composition API
```

## Native Middleware Support

Lattice adapters are thin wrappers that preserve full compatibility with native middleware. Use your favorite tools like Redux DevTools or Zustand persist without any changes, and full type awareness:

```typescript
// Redux with DevTools
const store = createReduxAdapter(createComponent, (config) => 
  configureStore({
    ...config,
    devTools: { name: 'My App' }
  })
);

// Zustand with persist
import { persist } from 'zustand/middleware';

const store = createZustandAdapter(
  createComponent,
  (stateCreator, createStore) => 
    createStore(persist(stateCreator, { name: 'app-storage' }))
);
```

Your behavioral components stay portable while keeping full access to the underlying state management features.

## Documentation

- **[Core Concepts](./packages/core/README.md)** - Deep dive into slices, composition, and architecture
- **[Adapter Guide](./packages/adapter-redux/README.md)** - How to use and create adapters
- **[Runtime Hooks](./packages/runtime/README.md)** - React and Vue integration
- **[Examples](./packages/runtime/examples)** - Sample applications and patterns

## Why Lattice?

### The Problem with Current Headless Component Solutions

Building truly reusable UI components requires separating behavior from presentation. Current approaches fall short:

- **Class-based inheritance** creates fragile hierarchies where overriding methods can break essential functionality
- **Framework-specific solutions** lock you into React hooks, Vue composables, or Svelte stores
- **Vanilla JavaScript** loses the benefits of reactivity and requires manual subscription management
- **Multiple implementations** means maintaining the same logic across different frameworks

### How Lattice Solves This

Lattice provides a minimal abstraction (`get`, `set`, `subscribe`) that maps to any reactive system. This enables:

- **Functional composition** instead of inheritance - combine behaviors without worrying about method overrides
- **True portability** - the same behavior specification works in any JavaScript environment
- **Explicit dependencies** - composed behaviors declare what they need, preventing accidental breakage
- **Tree-scoped state** - unlike global stores, components get isolated instances with surgical updates

### Technical Benefits
- **Type Safety**: Full TypeScript inference from behavior definition to UI usage
- **Performance**: More efficient than React Context, with surgical updates only where needed
- **Testability**: Test behaviors in isolation without framework-specific testing utilities
- **Extensibility**: Compose third-party behaviors with your own without modification

## Contributing

Lattice is designed to be extensible. Create adapters for your favorite state management library or contribute improvements to existing ones.

## License

MIT