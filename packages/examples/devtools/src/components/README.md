# Lattice Components

This directory demonstrates the **component pattern** with Lattice - building reusable, framework-agnostic UI behaviors.

## The Pattern

A Lattice component is a **plain function** that:
1. Accepts a signal API (or any reactive primitive factory)
2. Creates reactive state using those primitives
3. Returns a public API with getters and actions
4. Is completely framework-agnostic

```typescript
export function createCounter(api: SignalAPI) {
  const count = api.signal(0);

  return {
    count: () => count(),
    increment: () => count(count() + 1),
  };
}
```

## Why This Pattern?

### ✅ Framework Agnostic
The same component works in React, Vue, Svelte, Solid, or vanilla JS:

```typescript
// React
const counter = createCounter(api);
const count = useSignal(counter.count);

// Vue
const counter = createCounter(api);
const count = ref(counter.count());

// Vanilla
const counter = createCounter(api);
counter.increment();
```

### ✅ Testable in Isolation
Test components without any framework:

```typescript
import { createCounter } from './counter';
import { createSignalAPI } from '@lattice/signals/api';

test('counter increments', () => {
  const api = createSignalAPI(/* ... */);
  const counter = createCounter(api);

  counter.increment();
  expect(counter.count()).toBe(1);
});
```

### ✅ Composable
Components can use other components:

```typescript
export function createFilteredTodos(api: SignalAPI) {
  const todoList = createTodoList(api);
  const filter = createFilter(api);

  const filtered = api.computed(() =>
    filter.filterTodos(todoList.todos())
  );

  return { todoList, filter, filtered };
}
```

### ✅ Clear API Boundaries
Components have explicit public APIs:

```typescript
export interface CounterAPI {
  // Getters - read reactive state
  count(): number;
  doubled(): number;

  // Actions - update state
  increment(): void;
  decrement(): void;
}
```

## Components in This Example

### `counter.ts`
Simple reactive state with derived values. Demonstrates:
- Basic signal usage
- Computed values
- Public API design

### `todo-list.ts`
Managing collections of items. Demonstrates:
- Working with arrays in signals
- Immutable updates
- Multiple computed values
- Batch operations

### `filter.ts`
Filtering functionality that composes with any todo list. Demonstrates:
- **Functional composition** - pure utility functions
- Utility functions that work with any data
- Stateful filtering

### `todo-stats.ts`
Statistics computed from a TodoList. Demonstrates:
- **Dependency injection** - depends on TodoListAPI
- Deriving data from other components
- Composition through dependencies (not inheritance)

## Usage Pattern

```typescript
// 1. Create your signal API
const api = createSignalAPI(/* ... */);

// 2. Create component instances
const counter = createCounter(api);
const todoList = createTodoList(api);
const filter = createFilter(api);

// 3. Compose them together in different ways:

// Functional composition - combine outputs
const filteredTodos = api.computed(() =>
  filter.filterTodos(todoList.todos())
);

// Dependency injection - stats depends on todoList
const todoStats = createTodoStats(api, todoList);

// 4. Use in your UI
counter.increment();
todoList.addTodo('Learn Lattice');
filter.setFilter('active');
console.log(todoStats.completionRate()); // 0%
```

## From Components to Extensions

These components can easily become Lattice extensions:

```typescript
function createCounterExtension(ctx): LatticeExtension<'counter', CounterAPI> {
  const counter = createCounter(ctx);

  return {
    name: 'counter',
    method: counter,
    destroy() {
      // cleanup if needed
    }
  };
}
```

This gives you:
- Lifecycle hooks (`init`, `destroy`)
- Context awareness
- Optional instrumentation
- Dependency injection

## Next Steps

1. **Try it yourself**: Modify these components or create your own
2. **Test in isolation**: Write tests for each component separately
3. **Use in a framework**: See how the same components work in React/Vue/Svelte
4. **Build something real**: Create a form validator, modal manager, or data table component
