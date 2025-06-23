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

Lattice lets you write UI behavior as composable functions that work with any framework. Instead of inheriting from base classes or coupling to specific frameworks, you compose behaviors using a reactive slice pattern with selectors and computed values that automatically track dependencies.

This enables you to:
- Write a modal's focus trap behavior once and use it in React, Vue, Svelte, or vanilla JS
- Compose complex behaviors from simpler ones (combine keyboard navigation + focus management + animations)
- Share behavioral patterns across different components without inheritance
- Keep behaviors framework-agnostic while maintaining full type safety

```typescript
// Define a headless dropdown behavior
const createDropdown = (createSlice) => {
  const dropdown = createSlice(
    // Phase 1: Select dependencies from state
    (selectors) => ({
      isOpen: selectors.isOpen,
      selectedIndex: selectors.selectedIndex,
      items: selectors.items
    }),
    // Phase 2: Define computed values and actions
    ({ isOpen, selectedIndex, items }, set) => ({
      // State accessors
      isOpen: () => isOpen(),
      selectedIndex: () => selectedIndex(),
      
      // Actions
      open: () => set(
        (selectors) => ({ isOpen: selectors.isOpen }),
        () => ({ isOpen: true })
      ),
      close: () => set(
        (selectors) => ({ isOpen: selectors.isOpen, selectedIndex: selectors.selectedIndex }),
        () => ({ isOpen: false, selectedIndex: -1 })
      ),
      toggle: () => set(
        (selectors) => ({ isOpen: selectors.isOpen }),
        ({ isOpen }) => ({ isOpen: !isOpen() })
      ),
      
      // Keyboard navigation
      selectNext: () => set(
        (selectors) => ({ selectedIndex: selectors.selectedIndex, items: selectors.items }),
        ({ selectedIndex, items }) => ({ 
          selectedIndex: Math.min(selectedIndex() + 1, items().length - 1) 
        })
      ),
      selectPrevious: () => set(
        (selectors) => ({ selectedIndex: selectors.selectedIndex }),
        ({ selectedIndex }) => ({ 
          selectedIndex: Math.max(selectedIndex() - 1, -1) 
        })
      ),
      
      // Item management
      setItems: (newItems) => set(
        (selectors) => ({ items: selectors.items }),
        () => ({ items: newItems })
      ),
      selectItem: (index) => set(
        (selectors) => ({ selectedIndex: selectors.selectedIndex, isOpen: selectors.isOpen }),
        () => ({ selectedIndex: index, isOpen: false })
      )
    })
  );
  
  return { dropdown };
};

// Use the same behavior across different frameworks
import { createStore } from '@lattice/adapter-store-react';
import { createStore as createPiniaStore } from '@lattice/adapter-pinia';
import { createStore as createSvelteStore } from '@lattice/core'; // Direct core usage with runes

// Each adapter creates a store that returns a slice factory
const reactCreateSlice = createStore({ isOpen: false, selectedIndex: -1, items: [] });
const reactDropdown = createDropdown(reactCreateSlice);

// For Svelte 5 + Runes - use core directly with $state
const svelteState = $state({ isOpen: false, selectedIndex: -1, items: [] });
const svelteCreateSlice = createSvelteStore(svelteState);
const svelteDropdown = createDropdown(svelteCreateSlice);

const vueCreateSlice = createPiniaStore({ isOpen: false, selectedIndex: -1, items: [] });
const vueDropdown = createDropdown(vueCreateSlice);

const svelteCreateSlice = createSvelteStore({ isOpen: false, selectedIndex: -1, items: [] });
const svelteDropdown = createDropdown(svelteCreateSlice);
```

## Key Benefits

### True Behavioral Composition
Unlike class-based inheritance, Lattice enables functional composition of behaviors. You can combine keyboard navigation from one package, focus management from another, and your custom logic - all without worrying about inheritance chains or method overrides.

```typescript
// Compose behaviors by using slice handles to select computed values
const accessibleDropdown = createSlice(
  (selectors) => ({
    ...selectors, // Include all base state
    // Select computed values from other slices
    ...dropdown(d => ({ 
      dropdownOpen: d.open,
      dropdownClose: d.close 
    })),
    ...focusTrap(f => ({ 
      trapActivate: f.activate,
      trapRelease: f.release 
    })),
    ...announcements(a => ({ announce: a.announce }))
  }),
  ({ dropdownOpen, dropdownClose, trapActivate, trapRelease, announce }, set) => ({
    // Combine behaviors
    open: () => {
      dropdownOpen();
      trapActivate();
      announce('Dropdown opened');
    },
    close: () => {
      trapRelease();
      dropdownClose();
      announce('Dropdown closed');
    }
  })
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
Behaviors are defined using a two-phase reactive pattern: first selecting dependencies, then computing values and actions. This enables automatic dependency tracking:

```typescript
const dropdown = createSlice(
  // Phase 1: Select state dependencies
  (selectors) => ({ isOpen: selectors.isOpen }),
  // Phase 2: Compute values and actions based on dependencies
  ({ isOpen }, set) => ({
    isOpen: () => isOpen(),
    open: () => set(
      (selectors) => ({ isOpen: selectors.isOpen }),
      () => ({ isOpen: true })
    ),
    close: () => set(
      (selectors) => ({ isOpen: selectors.isOpen }),
      () => ({ isOpen: false })
    ),
    toggle: () => set(
      (selectors) => ({ isOpen: selectors.isOpen }),
      ({ isOpen }) => ({ isOpen: !isOpen() })
    )
  })
);
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

// Do this - explicit composition by selecting from slice handles
const accessibleDropdown = createSlice(
  (selectors) => ({
    ...selectors,
    // Select specific methods from composed slices
    ...dropdown(d => ({ dropdownOpen: d.open })),
    ...focusTrap(f => ({ trapActivate: f.activate }))
  }),
  ({ dropdownOpen, trapActivate }, set) => ({
    open: () => {
      dropdownOpen();
      trapActivate();
    }
  })
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

// Compose multiple behaviors into a full dropdown
const dropdown = createSlice(
  (selectors) => ({
    ...selectors,
    // Select all methods from each behavior slice
    ...toggleable(t => ({ toggle: t.toggle, isOpen: t.isOpen })),
    ...selectable(s => ({ select: s.select, selected: s.selected })),
    ...navigable(n => ({ next: n.next, previous: n.previous })),
    ...focusable(f => ({ focus: f.focus, blur: f.blur }))
  }),
  ({ toggle, isOpen, select, selected, next, previous, focus, blur }, set) => ({
    // Combine all behaviors into unified API
    isOpen: () => isOpen(),
    toggle: () => toggle(),
    select: (item) => select(item),
    selected: () => selected(),
    navigateNext: () => next(),
    navigatePrevious: () => previous(),
    focus: () => focus(),
    blur: () => blur()
  })
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

// Create a store with your adapter of choice
import { createStore } from '@lattice/adapter-zustand';

const createSlice = createStore<AppState>({
  user: null,
  items: [],
  settings: { theme: 'light' }
});

const createComponent = (createSlice: RuntimeSliceFactory<AppState>) => {
  // Methods are fully typed with parameter and return types
  const user = createSlice(
    (selectors) => ({ user: selectors.user }),
    ({ user }, set) => ({
      current: () => user(), // Return type: { id: string; name: string } | null
      login: (id: string, name: string) => set(
        (selectors) => ({ user: selectors.user }),
        () => ({ user: { id, name } })
      ),
      logout: () => set(
        (selectors) => ({ user: selectors.user }),
        () => ({ user: null })
      )
    })
  );

  // TypeScript catches errors at compile time
  const cart = createSlice(
    (selectors) => ({ items: selectors.items }),
    ({ items }, set) => ({
      addItem: (id: string, price: number) => set(
        (selectors) => ({ items: selectors.items }),
        ({ items }) => ({ items: [...items(), { id, price }] })
      ),
      // This would cause a TypeScript error:
      // ({ items }) => ({ items: [...items(), { id, cost: price }] }) // Error: 'cost' doesn't exist
    })
  );

  return { user, cart };
};

// Type inference flows through to React components
import { useSlice } from '@lattice/runtime/react';

// Assuming we have created the component
const { user: userSlice, cart: cartSlice } = createComponent(createSlice);

function UserProfile() {
  // TypeScript knows items is an array of { id: string; price: number }
  const items = useSlice(cartSlice, c => c.items());
  
  // TypeScript knows currentUser is { id: string; name: string } | null
  const currentUser = useSlice(userSlice, u => u.current());
  
  if (!currentUser) return <div>Please log in</div>;
  
  // TypeScript knows currentUser is non-null here
  return <div>Welcome, {currentUser.name}!</div>;
}
```

## Architecture

```
┌─────────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Headless Components │────▶│ Lattice Core │────▶│ Adapters        │
│ (Behavioral Specs)  │     │ (selectors,  │     │ (React, Vue,    │
│                     │     │  set, slices)│     │  Svelte, etc)   │
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
npm install @lattice/core              # For Svelte 5 + Runes (direct usage)

# Framework integration (optional)
npm install @lattice/frameworks       # For framework-specific utilities
npm install @lattice/runtime          # For React/Vue/Svelte hooks
```

## Quick Start

```typescript
// 1. Define a headless modal behavior
import { createStore } from '@lattice/adapter-store-react';
import { useSlice } from '@lattice/runtime/react';

const createModal = (createSlice) => {
  const modal = createSlice(
    (selectors) => ({ isOpen: selectors.isOpen, content: selectors.content }),
    ({ isOpen, content }, set) => ({
      // State
      isOpen: () => isOpen(),
      content: () => content(),
      
      // Actions
      open: (newContent = null) => set(
        (selectors) => ({ isOpen: selectors.isOpen, content: selectors.content }),
        () => ({ isOpen: true, content: newContent })
      ),
      close: () => set(
        (selectors) => ({ isOpen: selectors.isOpen, content: selectors.content }),
        () => ({ isOpen: false, content: null })
      )
    })
  );
  
  // Compose with focus trap behavior
  const focusTrap = createSlice(
    (selectors) => ({ trapped: selectors.trapped }),
    ({ trapped }, set) => ({
      trapped: () => trapped(),
      trap: () => set(
        (selectors) => ({ trapped: selectors.trapped }),
        () => ({ trapped: true })
      ),
      release: () => set(
        (selectors) => ({ trapped: selectors.trapped }),
        () => ({ trapped: false })
      )
    })
  );
  
  // Combine behaviors by selecting from slice handles
  const accessibleModal = createSlice(
    (selectors) => ({
      ...selectors,
      // Select computed values from the component slices
      ...modal(m => ({ 
        modalOpen: m.open,
        modalClose: m.close,
        modalIsOpen: m.isOpen
      })),
      ...focusTrap(f => ({ 
        trap: f.trap,
        release: f.release 
      }))
    }),
    ({ modalOpen, modalClose, modalIsOpen, trap, release }, set) => ({
      open: (content) => {
        modalOpen(content);
        trap();
      },
      close: () => {
        release();
        modalClose();
      },
      isOpen: () => modalIsOpen()
    })
  );
  
  return { modal: accessibleModal };
};

// 2. Create the store and component
const createSlice = createStore({ isOpen: false, content: null, trapped: false });
const { modal } = createModal(createSlice);

function Modal() {
  const isOpen = useSlice(modal, m => m.isOpen());
  const modalActions = useSlice(modal);
  
  if (!isOpen) return null;
  return (
    <div role="dialog">
      <button onClick={() => modalActions.close()}>Close</button>
    </div>
  );
}

// 3. Or use it in Vue with a different adapter
import { createStore as createPiniaStore } from '@lattice/adapter-pinia';
import { useSlice as useVueSlice } from '@lattice/runtime/vue';

const vueCreateSlice = createPiniaStore({ isOpen: false, content: null, trapped: false });
const { modal: vueModal } = createModal(vueCreateSlice);
// Now use with Vue's composition API
```

## Native Middleware Support

Lattice adapters are thin wrappers that preserve full compatibility with native middleware. Use your favorite tools like Redux DevTools or Zustand persist without any changes, and full type awareness:

```typescript
// Zustand with persist middleware
import { createStore } from '@lattice/adapter-zustand';
import { persist } from 'zustand/middleware';

const createSlice = createStore(
  { count: 0, user: null },
  {
    enhancer: (stateCreator, create) => 
      create(persist(stateCreator, { name: 'app-storage' }))
  }
);

// Redux with DevTools
import { createStore as createReduxStore } from '@lattice/adapter-redux';

const reduxSlice = createReduxStore(
  { count: 0, user: null },
  {
    devTools: { name: 'My App' }
  }
);
```

Your behavioral components stay portable while keeping full access to the underlying state management features.

## Documentation

- **[Core Package](./packages/core)** - Core reactive slice system and composition utilities
- **[Adapters](./packages)** - State management adapters for Redux, Zustand, Pinia, and more (see adapter-* packages)
- **[Runtime Hooks](./packages/runtime)** - React, Vue, and Svelte integration hooks
- **[Example: Dropdown](./packages/examples/dropdown)** - Sample dropdown implementation

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