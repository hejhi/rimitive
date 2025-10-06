# The Lattice Component Pattern

Build behavioral components once, use them in any JavaScript framework.

## What is the Component Pattern?

The component pattern in Lattice is a way to build **reusable, framework-agnostic UI behaviors**. These aren't UI components - they're the *behavior* that powers UI components.

Think of it like this:
- **Traditional approach**: Build a counter component in React, rebuild it in Vue, rebuild it in Svelte
- **Lattice approach**: Build counter *behavior* once, use it everywhere with a simple adapter

## The Three Layers

### 1. Component Definition (Framework-Agnostic)

Components are plain functions that accept a signal API and return behavior:

```typescript
// components/counter.ts
export function createCounter(api: SignalAPI) {
  const count = api.signal(0);
  const doubled = api.computed(() => count() * 2);

  return {
    // Getters - read reactive state
    count: () => count(),
    doubled: () => doubled(),

    // Actions - update state
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
  };
}
```

This component:
- ✅ Has no framework dependencies
- ✅ Can be tested without any framework
- ✅ Works in React, Vue, Svelte, vanilla JS
- ✅ Has a clear, typed API

### 2. Framework Adapter

Each framework has a thin adapter that handles lifecycle and reactivity:

```typescript
// React
import { useComponent, useSubscribe } from '@lattice/react';

function StepCounter() {
  const counter = useComponent(createCounter);
  const count = useSubscribe(counter.count);

  return <button onClick={counter.increment}>Step {count}</button>;
}

// Vue (future)
import { useComponent } from '@lattice/vue';

const counter = useComponent(createCounter);
const count = ref(counter.count());

// Svelte (future)
import { component } from '@lattice/svelte';

let counter = component(createCounter);
$: count = counter.count();
```

### 3. UI Components

UI components use the behavior via the framework adapter:

```typescript
// StepCounter.tsx - for a wizard
function StepCounter() {
  const counter = useComponent(createCounter);
  const step = useSubscribe(counter.count);

  return (
    <div>
      <button onClick={counter.decrement}>Back</button>
      <span>Step {step} / 5</span>
      <button onClick={counter.increment}>Next</button>
    </div>
  );
}

// SlideCarousel.tsx - for a slideshow
function SlideCarousel({ slides }) {
  const counter = useComponent(createCounter);
  const current = useSubscribe(counter.count);

  return (
    <div>
      <div>{slides[current]}</div>
      <button onClick={counter.decrement}>←</button>
      <span>{current + 1} / {slides.length}</span>
      <button onClick={counter.increment}>→</button>
    </div>
  );
}
```

**Same behavior, different UI, different use cases.**

## Real-World Example: Design System

Here's how you'd build a design system with this pattern:

### Step 1: Define Behaviors

```typescript
// @your-company/behaviors
export { createCounter } from './counter';
export { createCarousel } from './carousel';
export { createModal } from './modal';
export { createFormValidator } from './form-validator';
export { createTabs } from './tabs';
export { createDropdown } from './dropdown';
```

### Step 2: Framework Packages

```typescript
// @your-company/react
import { useComponent, useSubscribe } from '@lattice/react';
import { createModal } from '@your-company/behaviors';

export function Modal({ children }) {
  const modal = useComponent(createModal);
  const isOpen = useSubscribe(modal.isOpen);

  return isOpen ? (
    <div className="modal">
      <button onClick={modal.close}>×</button>
      {children}
    </div>
  ) : null;
}
```

```typescript
// @your-company/vue
import { useComponent } from '@lattice/vue';
import { createModal } from '@your-company/behaviors';

export default {
  setup() {
    const modal = useComponent(createModal);
    return { modal };
  }
}
```

### Step 3: Use Anywhere

```typescript
// React app
import { Modal } from '@your-company/react';

// Vue app
import { Modal } from '@your-company/vue';

// Svelte app
import { Modal } from '@your-company/svelte';
```

**Same behavior, same tests, same bugs fixed once, same features everywhere.**

## Benefits

### 1. Write Once, Use Everywhere
```typescript
// One component definition
export function createFormValidator(api, rules) { ... }

// Works in React
const validator = useComponent(createFormValidator, rules);

// Works in Vue
const validator = useComponent(createFormValidator, rules);

// Works in Svelte
const validator = component(createFormValidator, rules);

// Works in vanilla JS
const validator = createFormValidator(api, rules);
```

### 2. Test Without Frameworks
```typescript
import { createCounter } from './counter';
import { createSignalAPI } from '@lattice/signals/api';

test('counter increments', () => {
  const api = createSignalAPI(/* ... */);
  const counter = createCounter(api);

  counter.increment();
  expect(counter.count()).toBe(1);

  // No React, no Vue, no Svelte - just pure logic
});
```

### 3. Clear API Boundaries
```typescript
export interface CounterAPI {
  // Explicit interface
  count(): number;
  doubled(): number;
  increment(): void;
  decrement(): void;
}

export function createCounter(api): CounterAPI {
  // Implementation details hidden
}
```

### 4. Composability
```typescript
export function createFilteredTodos(api) {
  const todoList = createTodoList(api);
  const filter = createFilter(api);

  const filtered = api.computed(() =>
    filter.filterTodos(todoList.todos())
  );

  return { todoList, filter, filtered };
}
```

## Examples in This Repo

1. **DevTools Example** (`/packages/examples/devtools/`)
   - Three components: Counter, TodoList, Filter
   - Demonstrates composition and clear APIs
   - See `src/components/README.md` for details

2. **React Example** (`/packages/examples/react-component-pattern.tsx`)
   - Shows how to use components in React
   - StepCounter, SlideCarousel, TodoApp
   - Same components, different use cases

## Getting Started

1. **Define a component**:
   ```typescript
   export function createYourComponent(api, ...args) {
     const state = api.signal(initialState);

     return {
       state: () => state(),
       action: () => state(newValue),
     };
   }
   ```

2. **Use in React**:
   ```typescript
   import { useComponent, useSubscribe } from '@lattice/react';

   function YourComponent() {
     const component = useComponent(createYourComponent, args);
     const state = useSubscribe(component.state);

     return <div onClick={component.action}>{state}</div>;
   }
   ```

3. **Test it**:
   ```typescript
   test('your component works', () => {
     const api = createSignalAPI(/* ... */);
     const component = createYourComponent(api, args);

     component.action();
     expect(component.state()).toBe(expected);
   });
   ```

## Future: Framework Adapters

We currently have `@lattice/react`. Coming soon:
- `@lattice/vue` - Vue 3 Composition API adapter
- `@lattice/svelte` - Svelte 5 Runes adapter
- `@lattice/solid` - Solid.js adapter

Each will provide `useComponent` (or equivalent) to make component usage feel native to that framework.

## Philosophy

This pattern embodies the Lattice philosophy:

1. **Composability over monoliths** - Small, focused components that combine
2. **Framework agnostic** - Don't lock yourself into one ecosystem
3. **Test-driven** - Pure logic that's easy to test
4. **Type-safe** - Full TypeScript inference throughout
5. **Performance** - Fine-grained reactivity, only re-render what changed

---

**Ready to build?** Check out the examples in `/packages/examples/` or start with the [DevTools example](./packages/examples/devtools/README.md).
