# Lattice React Component Pattern Example

This example demonstrates the **component pattern** in React with DevTools integration.

## What's Demonstrated

### 1. Framework-Agnostic Components

The example uses components from `src/components/`:
- **Counter** - Simple reactive state with derived values
- **TodoList** - Managing collections
- **Filter** - Composable filtering behavior
- **Modal** - Design system component with encapsulated state

These component behaviors work in any framework - React, Vue, Svelte, or vanilla JS.

### 2. Using Components in React

Three examples show different use cases:

#### StepCounter
Uses `createCounter` for a multi-step wizard:
```tsx
const counter = useComponent(createCounter);
const step = useSubscribe(counter.count);

return <button onClick={counter.increment}>Step {step}</button>;
```

#### SlideCarousel
**Same `createCounter` component**, different UI:
```tsx
const counter = useComponent(createCounter);
const current = useSubscribe(counter.count);

return <div>Slide {current + 1}</div>;
```

#### TodoApp
Composes `createTodoList` + `createFilter` together:
```tsx
const todoList = useComponent(createTodoList, initialTodos);
const filter = useComponent(createFilter);
const filteredTodos = filter.filterTodos(todoList.todos());
```

### 3. DevTools Integration

The app is wrapped in `<SignalProvider>` which:
- Creates an instrumented signal API
- Enables the Chrome DevTools "Lattice" tab
- Shows all reactive state changes in real-time

### 4. Design System Pattern - Encapsulated State

The Modal component demonstrates how design system components can have their own isolated signal contexts:

```tsx
export function Modal({ title, children }: ModalProps) {
  // Each Modal creates its own SignalProvider!
  const api = React.useMemo(() => createComponentSignalAPI(), []);

  return (
    <SignalProvider api={api}>
      <ModalContent title={title}>
        {children}
      </ModalContent>
    </SignalProvider>
  );
}
```

This pattern is similar to how Chakra UI components manage internal state:
- ✅ Each instance has completely isolated state
- ✅ No state pollution between instances
- ✅ Still integrates with DevTools for debugging
- ✅ Perfect for reusable design system components

## Running the Example

```bash
# From the monorepo root
pnpm install

# Start the dev server
pnpm --filter @lattice/example-react dev

# Or from the examples directory
pnpm --filter @lattice/examples dev:react

# The app will open automatically at http://localhost:5173
```

## Using the DevTools

1. Open Chrome DevTools (F12)
2. Navigate to the "Lattice" tab
3. Interact with the UI (click buttons, add todos, etc.)
4. Watch events flow through:
   - `SIGNAL_READ` - When signals are accessed
   - `SIGNAL_WRITE` - When signals are updated
   - `COMPUTED_READ` - When computed values are accessed
   - `COMPUTED_VALUE` - When computed values recompute
   - `EFFECT_RUN_START/END` - When effects execute

## Key Patterns

### Pattern 1: Shared Signal Context

Use a single `<SignalProvider>` at the app level for components that need to share state:

```tsx
// App.tsx
<SignalProvider api={signalAPI}>
  <StepCounter />
  <SlideCarousel />
  <TodoApp />
</SignalProvider>
```

### Pattern 2: Encapsulated Signal Context

Create a new `<SignalProvider>` inside each component instance for isolated state:

```tsx
// Modal.tsx
export function Modal({ children }: ModalProps) {
  const api = React.useMemo(() => createComponentSignalAPI(), []);

  return (
    <SignalProvider api={api}>
      <ModalContent>{children}</ModalContent>
    </SignalProvider>
  );
}

// Usage - each instance is isolated
<Modal title="Settings">...</Modal>
<Modal title="Help">...</Modal>
```

### useComponent Hook

Creates a component instance scoped to the React component lifecycle:

```tsx
const counter = useComponent(createCounter);        // No args
const todoList = useComponent(createTodoList, []); // With args
```

The hook:
- ✅ Creates the component once on mount
- ✅ Passes the signal API automatically
- ✅ Handles cleanup on unmount (via SignalProvider)

### useSubscribe Hook

Subscribes to reactive values and triggers re-renders:

```tsx
const count = useSubscribe(counter.count);
const todos = useSubscribe(todoList.todos);
```

Only re-renders when the subscribed value actually changes.

### Composition Pattern

Components can use other components:

```tsx
const todoList = useComponent(createTodoList, initialTodos);
const filter = useComponent(createFilter);

// Compose them together
const filteredTodos = filter.filterTodos(todoList.todos());
```

## Component Reusability

### Shared Context Examples

The same `createCounter` component is used for:
1. **StepCounter** - Multi-step wizard navigation
2. **SlideCarousel** - Slideshow with previous/next

### Encapsulated Context Examples

Multiple `Modal` instances, each with isolated state:
1. **Settings Modal** - Has its own open/close state
2. **Confirmation Modal** - Completely separate state
3. **Help Modal** - Independent from the others

This demonstrates the power of the pattern:
- Write behavior once, use in multiple contexts
- Choose shared or isolated state per use case
- Test without frameworks
- Works in React, Vue, Svelte, etc.

## File Structure

```
react/
├── src/
│   ├── components/          # Component behaviors
│   │   ├── counter.ts
│   │   ├── todo-list.ts
│   │   ├── filter.ts
│   │   └── modal.ts
│   ├── design-system/       # React UI components with encapsulated state
│   │   └── Modal.tsx
│   └── main.tsx             # React app
├── index.html
└── README.md
```

**Component behaviors** (`src/components/`) - Framework-agnostic logic that returns signals/computed for use with `useSubscribe`

**Design system components** (`src/design-system/`) - React UI components that create their own `<SignalProvider>` internally for encapsulated state

## Next Steps

1. **Modify components** - Try adding features to counter, todo-list, or filter
2. **Create new components** - Build a modal, form validator, or carousel
3. **Test independently** - Components can be tested without React
4. **Use in other frameworks** - Try the same components in Vue or Svelte

See the main [COMPONENT_PATTERN.md](../../../COMPONENT_PATTERN.md) for complete documentation.
