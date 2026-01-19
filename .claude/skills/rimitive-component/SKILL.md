---
name: rimitive-component
description: Create Rimitive view components with el, map, and match. Use when building UI components, rendering reactive content, handling events, or creating reusable view elements.
---

# Creating Rimitive View Components

Rimitive components are functions that return element specs. They use `el()` for elements, `map()` for lists, and `match()` for conditionals.

## Component Patterns

### Simple Components (Module-Level Service)

When the service is shared at module level:

```typescript
// service.ts
export const { el, signal, computed, map, match, on, mount } = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter)
);

// Counter.ts
import { el, signal, computed } from './service';

export const Counter = (initial = 0) => {
  const count = signal(initial);

  return el('div')(
    el('span')(computed(() => `Count: ${count()}`)),
    el('button').props({ onclick: () => count((c) => c + 1) })('Increment')
  );
};
```

### Portable Components (Service Injection)

When components need to work across different contexts:

```typescript
// (svc) => (props) => RefSpec
const Button =
  (svc: Service) => (props: { label: string; onClick: () => void }) => {
    const { el } = svc;
    return el('button').props({ onclick: props.onClick })(props.label);
  };

// Usage with use()
const App = (svc: Service) => {
  const { el, use } = svc;
  return el('div')(use(Button)({ label: 'Click me', onClick: handleClick }));
};
```

## Element API

### Basic Structure

```typescript
el(tagName)
  .props({
    /* HTML attributes and event handlers */
  })
  .ref(/* lifecycle callbacks */)(...children);
```

### Props

```typescript
el('input').props({
  // Static attributes
  type: 'text',
  placeholder: 'Enter name',
  className: 'input-field',

  // Reactive attributes (use signal or computed)
  value: nameSignal,
  disabled: computed(() => isSubmitting()),

  // Event handlers
  onclick: () => handleClick(),
  onchange: (e) => nameSignal((e.target as HTMLInputElement).value),
})();
```

### Children

```typescript
el('div')(
  'Static text', // string
  42, // number
  el('span')('Nested element'), // RefSpec
  computed(() => `Dynamic: ${value()}`), // Reactive
  someCondition ? el('p')('Conditional') : null // null renders nothing
);
```

### Lifecycle with ref()

```typescript
el('input').ref(
  // Autofocus on mount
  (elem) => elem.focus(),

  // ResizeObserver with cleanup
  (elem) => {
    const observer = new ResizeObserver(() => console.log('resized'));
    observer.observe(elem);
    return () => observer.disconnect();
  },

  // Event listener using on() helper
  on('input', (e) => value((e.target as HTMLInputElement).value))
)();
```

## Reactive Lists with map()

```typescript
const TodoList = () => {
  const todos = signal<Todo[]>([]);

  return el('ul')(
    map(
      todos, // source signal
      (todo) => todo.id, // key function (receives plain value)
      (
        todoSignal // render function (receives signal)
      ) => el('li')(computed(() => todoSignal().text))
    )
  );
};
```

The key function receives the plain value; the render function receives a signal wrapping the item.

## Conditionals with match()

### Boolean Matching

```typescript
match(isLoading, (loading) => (loading ? Spinner() : Content()));
```

### Status Matching

```typescript
match(resource, (state) => {
  switch (state.status) {
    case 'pending':
      return Spinner();
    case 'error':
      return ErrorMessage(state.error);
    case 'ready':
      return DataView(state.value);
  }
});
```

### Inline Conditional (No Match)

For simple cases, use ternary in children:

```typescript
el('div')(showDetails() ? Details() : null);
```

## Event Handling

### Direct Props

```typescript
el('button').props({
  onclick: () => count((c) => c + 1),
  onmouseenter: () => setHovered(true),
})('Click');
```

### Using on() Helper (Auto-Batches)

```typescript
el('input').ref(
  on('input', (e) => {
    // Multiple updates are batched automatically
    value((e.target as HTMLInputElement).value);
    touched(true);
  }),
  on('blur', () => validate())
)();
```

### Prevent Default / Stop Propagation

```typescript
el('form').props({
  onsubmit: (e) => {
    e.preventDefault();
    handleSubmit();
  },
})(/* ... */);
```

## Component Composition

### With Behaviors

```typescript
import { useCounter } from './behaviors/useCounter';

const Counter = () => {
  const { count, increment, decrement } = useCounter(0);

  return el('div')(
    el('span')(computed(() => `Count: ${count()}`)),
    el('button').props({ onclick: decrement })('-'),
    el('button').props({ onclick: increment })('+')
  );
};
```

### Passing Props

```typescript
const TodoItem = (
  todoSignal: Reactive<Todo>,
  onToggle: (id: number) => void,
  onRemove: (id: number) => void
) => {
  const todo = todoSignal();

  return el('div').props({ className: 'todo-item' })(
    el('input').props({
      type: 'checkbox',
      checked: computed(() => todoSignal().completed),
      onchange: () => onToggle(todo.id),
    })(),
    el('span')(computed(() => todoSignal().text)),
    el('button').props({ onclick: () => onRemove(todo.id) })('x')
  );
};
```

## Partial Application for Common Elements

```typescript
// Pre-bind frequently used elements
const div = el('div');
const button = el('button');
const input = el('input');

// Use without repeating tag names
const Form = () =>
  div.props({ className: 'form' })(
    div.props({ className: 'field' })(input.props({ type: 'text' })()),
    button.props({ type: 'submit' })('Submit')
  );
```

## Mounting

```typescript
import { mount } from './service';

const app = App();
const root = document.getElementById('root')!;
const ref = mount(app, root);

// Later: cleanup
ref.cleanup?.();
```

## File Structure

```
src/
├── service.ts              # Composed service exports
├── components/
│   ├── Counter.ts
│   ├── TodoList.ts
│   └── TodoItem.ts
└── behaviors/
    └── useCounter.ts
```
