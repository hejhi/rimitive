---
name: rimitive-view
description: Build Rimitive views with el, map, and match. Use when building UI components, rendering reactive content, handling events, or creating reusable view elements.
---

# Creating Rimitive Views

Rimitive components are functions that return element specs. They use `el()` for elements, `map()` for lists, and `match()` for conditionals.

**Important:** Components run once. They are not reactive closures—there's no re-rendering or reconciliation at the function level. All reactivity is encapsulated in the primitives (`signal`, `computed`, `effect`). The function builds the element tree once; signals and computeds handle updates from there.

---

## Setting Up the Service

Add view modules to your service:

```typescript
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { MountModule } from '@rimitive/view/deps/mount';
import { OnModule } from '@rimitive/view/deps/addEventListener';

const adapter = createDOMAdapter();

export const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter),
  MountModule,
  OnModule
);

export const { signal, computed, effect, el, map, match, mount, on } = svc;
export type Service = typeof svc;
```

---

## Creating Elements

`el()` is curried: `el(tag)(children)`.

```typescript
// Just a tag
const div = el('div')();

// With text content
const heading = el('h1')('Hello, World');

// With children
const container = el('div')(
  el('h1')('Title'),
  el('p')('Some text')
);
```

---

## Adding Props

Use `.props()` to set attributes and event handlers:

```typescript
const button = el('button').props({
  className: 'primary',
  disabled: false,
  onclick: () => console.log('clicked'),
})('Click me');
```

Props are fully typed based on the adapter.

---

## Reactive Content

Pass a computed for reactive text:

```typescript
const count = signal(0);

const display = el('div')(
  computed(() => `Count: ${count()}`)
);

count(5);  // display updates to "Count: 5"
```

---

## Reactive Props

Props can be reactive too:

```typescript
const isDisabled = signal(false);

const button = el('button').props({
  disabled: isDisabled,  // reactive prop
  onclick: () => console.log('clicked'),
})('Submit');

isDisabled(true);  // button becomes disabled
```

Or use a computed for derived props:

```typescript
const count = signal(0);

const display = el('div').props({
  className: computed(() => count() > 10 ? 'warning' : 'normal'),
})(
  computed(() => `Count: ${count()}`)
);
```

---

## Components

Components are just functions that return elements:

```typescript
const Greeting = (name: string) => {
  return el('div')(
    el('h2')(`Hello, ${name}!`),
    el('p')('Welcome to Rimitive.')
  );
};

const app = el('div')(
  Greeting('Ada'),
  Greeting('Grace')
);
```

---

## Lifecycle with ref()

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

---

## Reactive Lists with map()

`map()` renders a reactive list efficiently. When items change, it updates only what's necessary.

### Basic Usage

For primitive arrays:

```typescript
const items = signal(['Apple', 'Banana', 'Cherry']);

const list = el('ul')(
  map(items, (item) => el('li')(item))
);
```

### Keyed Lists

For object arrays, provide a key function:

```typescript
type Todo = { id: number; text: string; done: boolean };

const todos = signal<Todo[]>([
  { id: 1, text: 'Learn Rimitive', done: false },
  { id: 2, text: 'Build something', done: false },
]);

const list = el('ul')(
  map(
    todos,
    (todo) => todo.id,  // key function (receives plain value)
    (todo) => el('li')( // render function (receives signal)
      el('span')(computed(() => todo().text)),
      el('input').props({
        type: 'checkbox',
        checked: computed(() => todo().done),
      })()
    )
  )
);
```

The key function receives the plain item value. The render function receives a signal wrapping the item.

### Reactive Item Updates

Each item is wrapped in a signal. When you update an item, the item signal updates—no element recreation:

```typescript
const toggleTodo = (id: number) => {
  todos(todos().map(t =>
    t.id === id ? { ...t, done: !t.done } : t
  ));
};
// The checkbox updates reactively without recreating the <li>
```

---

## Conditional Rendering with match()

`match()` swaps elements based on a reactive value.

### Show/Hide

```typescript
const showMessage = signal(true);

const message = match(showMessage, (show) =>
  show ? el('div')('Hello!') : null
);

const app = el('div')(
  el('button').props({
    onclick: () => showMessage(!showMessage())
  })('Toggle'),
  message
);
```

### Switching Views

```typescript
const isEditMode = signal(false);
const text = signal('Click edit to change');

const content = match(isEditMode, (editing) =>
  editing
    ? el('input').props({ value: text })()
    : el('span')(text)
);
```

### Multi-Way Switch

```typescript
type Tab = 'home' | 'settings' | 'profile';
const currentTab = signal<Tab>('home');

const tabContent = match(currentTab, (tab) => {
  switch (tab) {
    case 'home': return el('div')('Welcome home');
    case 'settings': return el('div')('Settings panel');
    case 'profile': return el('div')('Your profile');
  }
});
```

---

## Portals

`portal()` renders content to a different DOM location—useful for modals, tooltips, overlays:

```typescript
import { createPortalModule } from '@rimitive/view/portal';

// Add to your service composition
const svc = compose(
  // ... other modules
  createPortalModule(adapter)
);

const { portal } = svc;

// Render to document.body (default)
const modal = match(showModal, (show) =>
  show
    ? portal()(
        el('div').props({ className: 'modal-backdrop' })(
          el('div').props({ className: 'modal' })(
            el('h2')('Modal Title'),
            el('button').props({
              onclick: () => showModal(false)
            })('Close')
          )
        )
      )
    : null
);
```

---

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

---

## Component Patterns

### With Behaviors

```typescript
import { svc, el, computed } from './service';
import { counter } from './behaviors/counter';

const useCounter = svc(counter);

const Counter = (initial: number) => {
  const { count, doubled, increment, decrement } = useCounter(initial);

  return el('div')(
    el('div')(
      computed(() => `Count: ${count()} (doubled: ${doubled()})`)
    ),
    el('div')(
      el('button').props({ onclick: decrement })('-'),
      el('button').props({ onclick: increment })('+')
    )
  );
};
```

### Portable Components

```typescript
const Counter = (svc: Service) => {
  const { el, computed } = svc;
  const useCounter = svc(counter);

  return (initial: number) => {
    const { count, increment, decrement } = useCounter(initial);

    return el('div')(
      el('span')(computed(() => `Count: ${count()}`)),
      el('button').props({ onclick: decrement })('-'),
      el('button').props({ onclick: increment })('+')
    );
  };
};

// Usage
const App = (svc: Service) => {
  const { el, use } = svc;
  return el('div')(
    use(Counter)(0),
    use(Counter)(100)
  );
};
```

---

## Mounting

```typescript
import { el, mount } from './service';

const App = () => el('div')(
  el('h1')('My App')
);

const app = mount(App());
document.querySelector('#app')?.appendChild(app.element!);
```

---

## Complete Example: Todo List

```typescript
type Todo = { id: number; text: string; done: boolean };
type Filter = 'all' | 'active' | 'done';

const todos = signal<Todo[]>([]);
const filter = signal<Filter>('all');
const inputValue = signal('');
let nextId = 0;

const filteredTodos = computed(() => {
  const f = filter();
  const items = todos();
  if (f === 'all') return items;
  return items.filter(t => f === 'done' ? t.done : !t.done);
});

const addTodo = () => {
  const text = inputValue().trim();
  if (!text) return;
  todos([...todos(), { id: nextId++, text, done: false }]);
  inputValue('');
};

const toggleTodo = (id: number) => {
  todos(todos().map(t =>
    t.id === id ? { ...t, done: !t.done } : t
  ));
};

const FilterButton = (value: Filter, label: string) =>
  el('button').props({
    className: computed(() => filter() === value ? 'active' : ''),
    onclick: () => filter(value),
  })(label);

const App = () => el('div')(
  el('h1')('Todos'),

  // Input
  el('div')(
    el('input').props({
      type: 'text',
      placeholder: 'What needs to be done?',
      value: inputValue,
      oninput: (e: Event) => inputValue((e.target as HTMLInputElement).value),
      onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') addTodo(); },
    })(),
    el('button').props({ onclick: addTodo })('Add')
  ),

  // Filters
  el('div')(
    FilterButton('all', 'All'),
    FilterButton('active', 'Active'),
    FilterButton('done', 'Done')
  ),

  // List
  el('ul')(
    map(
      filteredTodos,
      (t) => t.id,
      (todo) => el('li')(
        el('input').props({
          type: 'checkbox',
          checked: computed(() => todo().done),
          onclick: () => toggleTodo(todo().id),
        })(),
        el('span')(computed(() => todo().text))
      )
    )
  ),

  // Empty state
  match(filteredTodos, (items) =>
    items.length === 0 ? el('p')('No todos yet') : null
  )
);

const app = mount(App());
document.body.appendChild(app.element!);
```
