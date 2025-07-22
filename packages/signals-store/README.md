# @lattice/signals-store

Signal-based state management extensions for [@lattice/lattice](../lattice).

This package provides reactive state management functionality through signals, computed values, and effects - all packaged as Lattice extensions.

## Installation

```bash
npm install @lattice/signals-store @lattice/lattice
```

## Quick Start

```typescript
import { createContext } from '@lattice/lattice';
import { coreExtensions } from '@lattice/signals-store';

// Create a reactive context with all signal extensions
const ctx = createContext(...coreExtensions);

// Create reactive state
const count = ctx.signal(0);
const doubled = ctx.computed(() => count.value * 2);

// React to changes
ctx.effect(() => {
  console.log(`Count: ${count.value}, Doubled: ${doubled.value}`);
});

// Update state
count.value = 5; // Logs: "Count: 5, Doubled: 10"
```

## Features

- **Fine-grained reactivity** - Only update what changes
- **Automatic dependency tracking** - No manual dependencies
- **Type-safe** - Full TypeScript inference
- **Memory efficient** - Automatic cleanup
- **Framework agnostic** - Use anywhere JavaScript runs

## Core Concepts

### Signals

Signals are reactive values that notify subscribers when they change:

```typescript
const name = ctx.signal('Alice');
const age = ctx.signal(25);

// Read values
console.log(name.value); // "Alice"

// Update values
name.value = 'Bob';
age.value++;

// Subscribe to changes
name.subscribe(() => {
  console.log(`Name changed to ${name.value}`);
});
```

### Computed Values

Computed values automatically derive from signals and other computeds:

```typescript
const firstName = ctx.signal('John');
const lastName = ctx.signal('Doe');

const fullName = ctx.computed(() => `${firstName.value} ${lastName.value}`);
console.log(fullName.value); // "John Doe"

firstName.value = 'Jane';
console.log(fullName.value); // "Jane Doe" - automatically updated
```

### Effects

Effects run side effects when their dependencies change:

```typescript
const user = ctx.signal({ id: 1, name: 'Alice' });

// Effect runs immediately and whenever dependencies change
ctx.effect(() => {
  console.log(`User ${user.value.name} logged in`);
  
  // Optional cleanup function
  return () => {
    console.log(`User ${user.value.name} logged out`);
  };
});
```

### Batching Updates

Batch multiple updates to prevent unnecessary recomputations:

```typescript
const x = ctx.signal(1);
const y = ctx.signal(2);
const sum = ctx.computed(() => x.value + y.value);

let computeCount = 0;
ctx.effect(() => {
  sum.value; // Subscribe to sum
  computeCount++;
});

// Without batching: would trigger 2 recomputations
ctx.batch(() => {
  x.value = 10;
  y.value = 20;
}); // Only triggers 1 recomputation
```

### Selectors

Create derived signals with transforms:

```typescript
const state = ctx.signal({
  user: { name: 'Alice', age: 25 },
  settings: { theme: 'dark' }
});

// Select specific parts with automatic memoization
const userName = ctx.select(state, s => s.user.name);
const userAge = ctx.select(state, s => s.user.age);

console.log(userName.value); // "Alice"

// Only userName subscribers are notified
state.value = {
  ...state.value,
  user: { ...state.value.user, name: 'Bob' }
};
```

## State Management Patterns

### Store Pattern

Build organized state management with the store pattern:

```typescript
interface TodoState {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
}
const createStore = () => createContext(...coreExtensions);

function createTodoStore(ctx = createStore()) {
  // State
  const todos = ctx.signal<Todo[]>([]);
  const filter = ctx.signal<'all' | 'active' | 'completed'>('all');
  
  // Computed
  const filteredTodos = ctx.computed(() => {
    const todoList = todos.value;
    const currentFilter = filter.value;
    
    if (currentFilter === 'all') return todoList;
    return todoList.filter(todo => 
      currentFilter === 'active' ? !todo.completed : todo.completed
    );
  });
  
  const stats = ctx.computed(() => ({
    total: todos.value.length,
    active: todos.value.filter(t => !t.completed).length,
    completed: todos.value.filter(t => t.completed).length
  }));
  
  // Actions
  const addTodo = (text: string) => {
    todos.value = [...todos.value, {
      id: Date.now(),
      text,
      completed: false
    }];
  };
  
  const toggleTodo = (id: number) => {
    todos.value = todos.value.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
  };
  
  const setFilter = (newFilter: typeof filter.value) => {
    filter.value = newFilter;
  };
  
  return {
    // State
    todos: todos.asReadonly(),
    filter: filter.asReadonly(),
    
    // Computed
    filteredTodos,
    stats,
    
    // Actions
    addTodo,
    toggleTodo,
    setFilter,
    
    // Cleanup
    dispose: () => ctx.dispose()
  };
}
```

### With React

```typescript
import { useSubscribe } from '@lattice/react';

function TodoApp() {
  const [store] = useState(() => createTodoStore());
  
  const todos = useSubscribe(store.filteredTodos);
  const stats = useSubscribe(store.stats);
  const filter = useSubscribe(store.filter);
  
  return (
    <div>
      <div>
        Active: {stats.active} | Completed: {stats.completed}
      </div>
      
      {todos.map(todo => (
        <TodoItem 
          key={todo.id} 
          todo={todo} 
          onToggle={() => store.toggleTodo(todo.id)}
        />
      ))}
      
      <FilterButtons 
        current={filter}
        onChange={store.setFilter}
      />
    </div>
  );
}
```

## Individual Extensions

For tree-shaking or custom contexts, import extensions individually:

```typescript
import { createContext } from '@lattice/lattice';
import { 
  signalExtension, 
  computedExtension, 
  effectExtension 
} from '@lattice/signals-store';

// Create a custom context with only what you need
const ctx = createContext(
  signalExtension,
  computedExtension,
  effectExtension
);
```

## Advanced Usage

### Custom Equality

Control when signals trigger updates:

```typescript
const user = ctx.signal(
  { name: 'Alice', preferences: { theme: 'dark' } },
  {
    equals: (a, b) => a.name === b.name // Only notify on name changes
  }
);
```

### Async Computeds

Handle async operations in computed values:

```typescript
const userId = ctx.signal(1);

const userData = ctx.computed(async () => {
  const id = userId.value;
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});

// Note: Returns Signal<Promise<User>>
ctx.effect(async () => {
  const user = await userData.value;
  console.log(`Loaded user: ${user.name}`);
});
```

### Resource Management

Ensure cleanup with lifecycle hooks:

```typescript
function createWebSocketStore(ctx = createContext(...coreExtensions)) {
  let ws: WebSocket;
  
  const messages = ctx.signal<Message[]>([]);
  const connected = ctx.signal(false);
  
  const connect = (url: string) => {
    ws = new WebSocket(url);
    
    ws.onopen = () => connected.value = true;
    ws.onclose = () => connected.value = false;
    ws.onmessage = (event) => {
      messages.value = [...messages.value, JSON.parse(event.data)];
    };
  };
  
  // Cleanup on context disposal
  ctx.onDispose(() => {
    ws?.close();
  });
  
  return { messages, connected, connect };
}
```

## Type Safety

Full TypeScript support with type inference:

```typescript
// Types are inferred
const count = ctx.signal(0); // Signal<number>
const doubled = ctx.computed(() => count.value * 2); // Computed<number>

// Explicit types when needed
interface User {
  id: string;
  name: string;
  email: string;
}

const currentUser = ctx.signal<User | null>(null);
const isLoggedIn = ctx.computed(() => currentUser.value !== null);
```

## API Reference

### Signal Methods

- `signal.value` - Get/set the current value
- `signal.subscribe(fn)` - Subscribe to changes
- `signal.asReadonly()` - Get a read-only version

### Computed Methods

- `computed.value` - Get the current computed value
- `computed.subscribe(fn)` - Subscribe to changes

### Effect Options

```typescript
ctx.effect(fn, {
  allowSignalWrites: true, // Allow writing to signals in effects
});
```

### Extensions

- `signalExtension` - Adds `signal()` method
- `computedExtension` - Adds `computed()` method  
- `effectExtension` - Adds `effect()` method
- `batchExtension` - Adds `batch()` method
- `selectExtension` - Adds `select()` method
- `subscribeExtension` - Adds `subscribe()` method

## Signals vs Other State Management

### Why Signals?

- **Fine-grained reactivity**: Only update what changed
- **Automatic dependency tracking**: No manual dependencies
- **Synchronous and predictable**: No async complexity
- **Memory efficient**: Automatic cleanup
- **Framework agnostic**: Use anywhere

### When to Use

- **Use signals for**: Local component state, shared UI state, reactive computations
- **Consider alternatives for**: Large-scale app state, complex async flows, time-travel debugging

## License

MIT
