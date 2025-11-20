# Lattice View Example

This example demonstrates how to build reactive UI applications using `@lattice/view` primitives and the component pattern.

## What This Demonstrates

### 1. **Component Pattern** (Framework-Agnostic Behaviors)

See `src/behaviors/`:

- `counter.ts` - Simple counter logic
- `todo-list.ts` - Complex stateful todo list

These are **headless components** - pure logic with no UI concerns. They can be:

- Used with any renderer (view, React, Vue, Svelte)
- Tested without any framework
- Shared across applications
- Composed together

### 2. **View Primitives** (Reactive DOM)

See `src/components/`:

- `Counter.ts` - Uses `el()` for reactive elements
- `TodoList.ts` - Uses `el()` and `map()` for reactive lists
- `ConditionalExample.ts` - Uses `el()` with conditional rendering (reactive specs)

The view primitives provide:

- **No virtual DOM** - direct DOM manipulation
- **Fine-grained reactivity** - only update what changed
- **No compilation** - pure TypeScript/JavaScript
- **Lifecycle management** - automatic cleanup

### 3. **Push-Pull FRP Algorithm**

Under the hood, `@lattice/view` uses the same push-pull algorithm as `@lattice/signals`:

- **Push phase**: Shallow propagation to mark dirty nodes
- **Pull phase**: Lazy evaluation only when values are read
- **Efficient updates**: Skip unnecessary recomputations

## Key Concepts

### el() - Reactive Elements

```typescript
el({
  tag: 'div',
  class: 'counter-display',
  children: [
    'Count: ',
    () => counter.count(), // Reactive text - auto-updates
    ' (doubled: ',
    () => counter.doubled(),
    ')',
  ],
});
```

- Children can be strings, functions (reactive), or other elements
- Functions are tracked as effects - re-run when dependencies change
- Automatic DOM updates when reactive values change

### map() - Reactive Lists

```typescript
map(
  () => todoList.filteredTodos(), // Source signal
  (todoSignal) => {
    // Render function
    return el({
      tag: 'div',
      children: [() => todoSignal().text],
    });
  },
  (todo) => todo.id // Key function (identity-based)
);
```

- Efficiently reconciles list changes (add, remove, reorder)
- Identity-based tracking (no keys required, but can provide key fn)
- Each item gets its own signal for fine-grained updates

### Conditional Rendering - Reactive Specs

```typescript
// Toggle visibility by returning null
el(
  computed(() => {
    if (!showMessage()) return null;
    return ['div', { className: 'message' }, 'Hello!'];
  })
);

// Switch between different element types
el(
  computed(() => {
    if (isEditMode()) {
      return ['input', { type: 'text', value: editText }];
    } else {
      return ['span', {}, editText];
    }
  })
);
```

- Pass a `Reactive<ElRefSpec | null>` instead of a static spec
- Element is recreated when the reactive spec changes
- Return `null` to render nothing (empty fragment)
- Efficiently swaps between different element types
- Automatic cleanup of old elements and their effects

### Lifecycle Management

```typescript
const counter = Counter(api, 10);

// Lifecycle callback - called when element connects
counter((el) => {
  console.log('Mounted', el);

  // Return cleanup function
  return () => {
    console.log('Unmounted', el);
  };
});
```

## Architecture

```
┌─────────────────────────────────────────┐
│ Headless Behaviors (Framework-Agnostic) │
│  - Pure logic                           │
│  - No UI concerns                       │
│  - Testable                             │
└──────────────┬──────────────────────────┘
               │
               │ Uses LatticeAPI
               │
┌──────────────▼──────────────────────────┐
│ View Components (Renderer-Specific)     │
│  - Uses el(), map()                   │
│  - Binds behaviors to DOM               │
│  - Handles events                       │
└──────────────┬──────────────────────────┘
               │
               │ Creates DOM
               │
┌──────────────▼──────────────────────────┐
│ Browser DOM                              │
│  - Real DOM nodes                        │
│  - No virtual DOM                        │
│  - Direct manipulation                   │
└──────────────────────────────────────────┘
```

## Running the Example

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm --filter @lattice/example-view dev

# Build for production
pnpm --filter @lattice/example-view build
```

## Comparison with Other Approaches

### vs React

```typescript
// React - framework-specific, JSX compilation required
function Counter() {
  const [count, setCount] = useState(0);
  return <div onClick={() => setCount(c => c + 1)}>{count}</div>;
}

// Lattice View - framework-agnostic, no compilation
function Counter(api) {
  const counter = useCounter(api); // Reusable behavior
  return el({
    tag: 'div',
    on: { click: counter.increment },
    children: [() => counter.count()],
  });
}
```

### vs Vue

```vue
<!-- Vue - framework-specific, SFC compilation required -->
<template>
  <div @click="count++">{{ count }}</div>
</template>
<script setup>
const count = ref(0);
</script>
```

```typescript
// Lattice View - same as above, works anywhere
```

### vs Svelte

```svelte
<!-- Svelte - framework-specific, compiler required -->
<script>
  let count = 0;
</script>
<div on:click={() => count++}>{count}</div>
```

```typescript
// Lattice View - same as above, works anywhere
```

## Benefits

1. **No Compilation** - Pure TypeScript/JavaScript, works in any environment
2. **Framework Agnostic** - Behaviors work with any renderer
3. **Fine-Grained** - Only updates what changed, no diffing
4. **Type Safe** - Full TypeScript inference
5. **Small** - Minimal runtime overhead
6. **Testable** - Pure logic separated from UI

## Next Steps

- Try modifying the behaviors in `src/behaviors/`
- Create your own components in `src/components/`
- See how the same behaviors could work with React (`@lattice/react`)
- Explore the push-pull algorithm in `@lattice/signals`
