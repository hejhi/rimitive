# Using Lattice Extensions with React

The React bindings work seamlessly with the lattice extension system. Here's how to use custom extensions in React components.

## Standard Usage (No Extensions Needed)

Most React usage doesn't require extensions at all:

```tsx
import { signal } from '@lattice/signals';
import { useSubscribe } from '@lattice/react';

const count = signal(0);

function Counter() {
  const value = useSubscribe(count);
  return <div>{value}</div>;
}
```

## Using Extensions in React

If you're using lattice contexts with custom extensions:

```tsx
import { createContext } from '@lattice/lattice';
import { signalExtension } from '@lattice/lattice/extensions/signal';
import { useSubscribe } from '@lattice/react';
import { useRef, useEffect } from 'react';

// Custom extension
const timerExtension = {
  name: 'timer',
  method: (interval: number) => {
    const time = signal(Date.now());
    setInterval(() => {
      time.value = Date.now();
    }, interval);
    return time;
  }
};

function App() {
  // Create context with extensions
  const contextRef = useRef(null);
  if (!contextRef.current) {
    contextRef.current = createContext(
      signalExtension,
      timerExtension
    );
  }
  const ctx = contextRef.current;
  
  // Use the extension
  const timer = ctx.timer(1000);
  const time = useSubscribe(timer);
  
  // Cleanup
  useEffect(() => {
    return () => ctx.dispose();
  }, [ctx]);
  
  return <div>Time: {time}</div>;
}
```

## Best Practices

1. **Global Signals**: For app-wide state, create signals outside components:
   ```tsx
   // state.ts
   export const user = signal({ name: 'John' });
   
   // Component.tsx
   const userData = useSubscribe(user);
   ```

2. **Component Signals**: Use `useSignal` for component-local state:
   ```tsx
   function Form() {
     const [value, setValue] = useSignal('');
     return <input value={value} onChange={e => setValue(e.target.value)} />;
   }
   ```

3. **Context with Extensions**: Create contexts at app level:
   ```tsx
   // app-context.ts
   import { createContext } from '@lattice/lattice';
   import { signalExtension, computedExtension } from '@lattice/lattice/extensions';
   
   export const appContext = createContext(
     signalExtension,
     computedExtension
   );
   
   // Use in components
   const count = appContext.signal(0);
   ```

## Extension + Store Pattern

```tsx
import { createStore } from '@lattice/lattice';
import { createContext } from '@lattice/lattice';
import { signalExtension, computedExtension } from '@lattice/lattice/extensions';
import { useStore } from '@lattice/react';

function TodoApp() {
  // Create minimal context
  const ctx = createContext(signalExtension, computedExtension);
  
  // Use it with store
  const store = useStore(() => createStore(
    { todos: [], filter: 'all' },
    ctx
  ));
  
  // Store inherits context capabilities
  const todoCount = store.computed(() => store.state.todos.value.length);
  
  return <div>Todos: {useSubscribe(todoCount)}</div>;
}
```

## Key Points

- React bindings work with any signal-like value (Signal, Computed, Selected)
- Extensions are optional - standard signals work great for most use cases
- Custom extensions can add domain-specific reactive primitives
- The `useSubscribe` hook works with any reactive value, regardless of how it was created