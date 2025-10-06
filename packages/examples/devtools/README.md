# Lattice DevTools Example

This example demonstrates:
1. **The Component Pattern** - Building reusable, framework-agnostic UI behaviors
2. **DevTools Integration** - Debugging reactive state with Chrome DevTools
3. **Component Composition** - Combining multiple components together

## What's Demonstrated

### Component Pattern

The example is structured around **three portable components**:

- **Counter** (`src/components/counter.ts`) - Simple reactive state with derived values
- **TodoList** (`src/components/todo-list.ts`) - Managing collections
- **Filter** (`src/components/filter.ts`) - Composable filtering behavior

Each component:
- ✅ Accepts a signal API
- ✅ Returns a clean public API
- ✅ Works in any framework
- ✅ Can be tested in isolation

### DevTools Integration

The example shows how to:
- Set up instrumentation with `devtoolsProvider`
- Pass instrument functions to signal/computed/effect factories
- Debug reactive state changes in real-time

### Key Files

```
devtools/
├── src/
│   ├── components/
│   │   ├── counter.ts       # Counter component
│   │   ├── todo-list.ts     # TodoList component
│   │   ├── filter.ts        # Filter component
│   │   └── README.md        # Component pattern docs
│   └── main.ts              # Compose components + UI integration
├── index.html               # Demo UI
└── README.md                # This file
```

## Running the Example

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm --filter @lattice/examples dev

# Open http://localhost:5173/devtools/
```

## Using the DevTools

1. Open Chrome DevTools (F12)
2. Navigate to the "Lattice" tab
3. Interact with the UI
4. Watch reactive events flow through in real-time

You'll see:
- `SIGNAL_READ` - When a signal is read
- `SIGNAL_WRITE` - When a signal is updated
- `COMPUTED_READ` - When a computed value is accessed
- `COMPUTED_VALUE` - When a computed value recomputes
- `EFFECT_RUN_START/END` - When effects execute

## The Component Pattern in Action

### Before (inline signals):
```typescript
const count = signal(0);
const doubled = computed(() => count() * 2);
function increment() { count(count() + 1); }
```

### After (component):
```typescript
// Define once
export function createCounter(api) {
  const count = api.signal(0);
  const doubled = api.computed(() => count() * 2);

  return {
    count: () => count(),
    doubled: () => doubled(),
    increment: () => count(count() + 1),
  };
}

// Use anywhere
const counter = createCounter(api);
counter.increment();
```

### Benefits:
1. **Testable** - Test `createCounter` without any framework
2. **Reusable** - Use in React, Vue, Svelte, or vanilla JS
3. **Composable** - Combine with other components
4. **Clear API** - Explicit interface, no internal leakage

## Next Steps

1. **Modify the components** - Add new features to counter/todo-list
2. **Create new components** - Build a form validator or modal manager
3. **Test in isolation** - Write unit tests for each component
4. **Use in a framework** - Try using these components in React/Vue/Svelte

See `src/components/README.md` for detailed documentation on the component pattern.
