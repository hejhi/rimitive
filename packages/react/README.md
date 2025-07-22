# @lattice/react

React bindings for Lattice signals and stores.

## Installation

```bash
npm install @lattice/react @lattice/signals-store
```

## Quick Start

```tsx
import { useSignal, useSubscribe } from '@lattice/react';
import { signal } from '@lattice/signals';

// Global signal
const count = signal(0);

function Counter() {
  // Local signal
  const [local, setLocal] = useSignal(0);
  
  // Subscribe to global signal
  const global = useSubscribe(count);

  return (
    <div>
      <button onClick={() => setLocal(local + 1)}>Local: {local}</button>
      <button onClick={() => count.value++}>Global: {global}</button>
    </div>
  );
}
```

## Hooks

### `useSubscribe`
Subscribe to any signal, computed, or selected value.

```tsx
const todos = useSubscribe(todoSignal);
const computed = useSubscribe(store.computed(() => ...));
```

### `useSignal`
Create component-local reactive state.

```tsx
const [value, setValue] = useSignal('initial');
```

### `useSelector`
Subscribe to specific parts of a signal for fine-grained reactivity.

```tsx
const user = signal({ name: 'John', age: 30, role: 'admin' });

function UserName() {
  // Only re-renders when name changes
  const name = useSelector(user, u => u.name);
  return <div>{name}</div>;
}
```

### `useStore`
Create a store with automatic disposal on unmount.

```tsx
function TodoApp() {
  const store = useStore(() => createStore({ 
    todos: [], 
    filter: 'all' 
  }));
  
  const todos = useSubscribe(store.state.todos);
  
  return (
    <div>{todos.map(todo => <Todo key={todo.id} {...todo} />)}</div>
  );
}
```

## Patterns

### Sharing Stores

Use React Context API:

```tsx
const AppContext = createContext<Store<AppState>>(null!);

function App() {
  const store = useStore(() => createStore(initialState));
  
  return (
    <AppContext.Provider value={store}>
      <Routes />
    </AppContext.Provider>
  );
}

function Child() {
  const store = useContext(AppContext);
  const user = useSubscribe(store.state.user);
  // ...
}
```

### Component-as-Function Pattern

Create headless reactive components by encapsulating business logic:

```tsx
// Define business logic with additional configuration
function TodoManager(
  store: Store<{ todos: Todo[]; filter: string }>,
  options = { maxTodos: 100 }
) {
  // Create reactive computed values
  const filtered = store.computed(() => {
    const todos = store.state.todos.value;
    const filter = store.state.filter.value;
    
    switch (filter) {
      case 'active': return todos.filter(t => !t.done);
      case 'done': return todos.filter(t => t.done);
      default: return todos;
    }
  });
  
  const stats = store.computed(() => ({
    total: store.state.todos.value.length,
    active: store.state.todos.value.filter(t => !t.done).length,
    done: store.state.todos.value.filter(t => t.done).length
  }));
  
  return {
    // Methods
    add(text: string) {
      if (store.state.todos.value.length >= options.maxTodos) {
        throw new Error(`Maximum ${options.maxTodos} todos reached`);
      }
      const todo = { id: Date.now(), text, done: false };
      store.state.todos.value = [...store.state.todos.value, todo];
    },
    
    toggle(id: number) {
      const todos = store.state.todos.value;
      const index = todos.findIndex(t => t.id === id);
      if (index >= 0) {
        store.state.todos.set(index, { 
          ...todos[index], 
          done: !todos[index].done 
        });
      }
    },
    
    setFilter(filter: 'all' | 'active' | 'done') {
      store.state.filter.value = filter;
    },
    
    clear() {
      store.state.todos.value = store.state.todos.value.filter(t => !t.done);
    },
    
    // Reactive getters
    get filtered() { return filtered.value; },
    get stats() { return stats.value; },
    get canAddMore() { return store.state.todos.value.length < options.maxTodos; }
  };
}

// Use in React
function TodoApp() {
  const store = useStore(() => createStore({ 
    todos: [], 
    filter: 'all' 
  }));
  
  // Pass configuration options
  const manager = useRef(TodoManager(store, { maxTodos: 50 })).current;
  
  // Subscribe to reactive values
  const filter = useSubscribe(store.state.filter);
  const stats = useSubscribe(manager.stats);
  
  return (
    <div>
      <div>
        Total: {stats.total} | Active: {stats.active} | Done: {stats.done}
      </div>
      
      <div>
        <button onClick={() => manager.setFilter('all')}>All</button>
        <button onClick={() => manager.setFilter('active')}>Active</button>
        <button onClick={() => manager.setFilter('done')}>Done</button>
      </div>
      
      <input 
        disabled={!manager.canAddMore}
        placeholder={manager.canAddMore ? 'Add todo...' : 'Max todos reached'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value) {
            manager.add(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
      
      {manager.filtered.map(todo => (
        <div key={todo.id} onClick={() => manager.toggle(todo.id)}>
          {todo.text}
        </div>
      ))}
      
      <button onClick={() => manager.clear()}>Clear completed</button>
    </div>
  );
}
```

### React Patterns vs Computed

Use React's built-in tools for derived values in components:

```tsx
// ❌ Don't use computed in React components
const total = useSubscribe(computed(() => items.value.length));

// ✅ Use React patterns instead
const items = useSubscribe(itemsSignal);
const total = useMemo(() => items.length, [items]);
```

Use `computed` for:
- Values shared across multiple components
- Logic outside React components
- Store-level derived state

## Performance Tips

1. **Use selectors for fine-grained updates:**
   ```tsx
   // Only re-renders when user.name changes
   const name = useSelector(userSignal, u => u.name);
   ```

2. **Batch updates to prevent multiple renders:**
   ```tsx
   import { batch } from '@lattice/signals';
   
   batch(() => {
     signal1.value = 'new';
     signal2.value = 'new';
   });
   ```

3. **Memoize expensive calculations:**
   ```tsx
   const items = useSubscribe(itemsSignal);
   const expensive = useMemo(() => complexCalc(items), [items]);
   ```

## Testing

```tsx
import { renderWithLattice, renderHookWithLattice } from '@lattice/react/testing';
import { act } from '@testing-library/react';

test('hook updates', () => {
  const count = signal(0);
  const { result } = renderHookWithLattice(() => useSubscribe(count));
  
  expect(result.current).toBe(0);
  
  act(() => { count.value = 5; });
  
  expect(result.current).toBe(5);
});
```

## License

MIT