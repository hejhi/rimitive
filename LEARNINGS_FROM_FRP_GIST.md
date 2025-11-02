# Learnings from Elegant FRP Implementation

Source: https://gist.github.com/ivenmarquardt/9f9d53e2469b3df438f3628297e2dc9f

## Core Insights

### 1. Closure-Based Type System (ADT in JavaScript)

**The Pattern:**
```javascript
const Data = name => Dcons => {
  const Data = k => {
    const t = new Tcons();
    t[`run${name}`] = k;  // Dynamic method based on type name
    t.tag = name;
    return t;
  };

  const Tcons = Function(`return function ${name}() {}`)();
  return Dcons(Data);
};

// Usage
const Event = Data("Event")(Event => k => Event(k));
const Behavior = Data("Behavior")(Behavior => k => Behavior(k));
const Eff = Data("Eff")(Eff => thunk => Eff(thunk));
```

**Why it's elegant:**
1. **Zero inheritance** - Pure functional approach
2. **Type-tagged values** - `.tag` property for pattern matching
3. **Protocol-based** - Each type has `run${TypeName}` method
4. **Clean stack traces** - Runtime function generation preserves names
5. **Minimal API surface** - Three types cover entire reactive system

**Application to @lattice/view:**

Currently we use numeric status flags:
```ts
export const STATUS_ELEMENT = 1;
export const STATUS_FRAGMENT = 2;
export const STATUS_REF_SPEC = 3;
```

**Could become:**
```ts
const NodeType = name => Ncons => {
  const NodeType = data => {
    const t = new Tcons();
    t[`run${name}`] = data;
    t.tag = name;
    return t;
  };

  const Tcons = Function(`return function ${name}() {}`)();
  return Ncons(NodeType);
};

const Element = NodeType("Element")(Element => element => Element({ element }));
const Fragment = NodeType("Fragment")(Fragment => data => Fragment(data));
const RefSpec = NodeType("RefSpec")(RefSpec => create => RefSpec({ create }));

// Usage becomes:
const el = Element(domElement);  // el.tag === "Element", el.runElement === { element }
const frag = Fragment({ firstChild, attach });  // frag.tag === "Fragment"
```

**Benefits:**
- Pattern matching: `switch(node.tag) { case "Element": ... }`
- Type-safe access: `node.runElement.element` vs unsafe casts
- Better debugging: Stack traces show "Element", "Fragment" instead of numbers
- Extensibility: User-space can create custom node types

---

### 2. Curried Markup Builders (Attributes → Children)

**The Pattern:**
```javascript
const markup = name => (...attr) => (...children) => {
  const el = document.createElement(name);
  attr.forEach(a => el.setAttributeNode(a));
  children.forEach(child => el.appendChild(child));
  return el;
};

// Usage
const li = markup("li");
li()(text(s))  // No attributes, one child
li(attr("class", "done"))(text(s))  // One attribute, one child
```

**Why it's elegant:**
1. **Clear separation** - Attributes phase, then children phase
2. **Partial application** - `const li_ = li()` creates reusable no-attr builder
3. **Type-safe** - Can't mix attributes and children
4. **Minimal allocations** - Reuse builders across components

**Application to @lattice/view:**

Currently:
```ts
el(['div', { className: 'foo' }, child1, child2])
```

**Could become:**
```ts
const div = el('div');
div({ className: 'foo' })(child1, child2)

// Reusable
const plainDiv = div();
plainDiv(child1, child2)
plainDiv(child3)  // Same builder, different children

// Factory pattern
const styledDiv = div({ className: 'styled' });
styledDiv(content1)
styledDiv(content2)
```

**Benefits:**
- **Reusability** - Create element builders once, apply many times
- **Less allocation** - `const button = el('button')` allocates once
- **Clearer intent** - Separation of structure (attrs) from content (children)
- **Better tree-shaking** - Unused element types eliminated

**Implementation:**
```ts
export function createElBuilder(tag: string) {
  return (attrs: Props = {}) => {
    const builder = (...children: Child[]) => {
      const element = renderer.createElement(tag);

      // Apply attributes
      for (const [key, val] of Object.entries(attrs)) {
        renderer.setAttribute(element, key, val);
      }

      // Append children
      for (const child of children) {
        processChild(element, child);
      }

      return element;
    };

    return builder;
  };
}

// Usage
const div = createElBuilder('div');
const button = createElBuilder('button');

const styledDiv = div({ className: 'container' });
styledDiv(child1, child2)
styledDiv(child3, child4)  // Reuse!
```

---

### 3. Targeted Patch Functions (No Re-rendering)

**The Pattern:**
```javascript
const patchAppendTodo = state => {
  const el = todoItem(state.todos.slice(-1));
  document.getElementById("todo-list").appendChild(el);
};

const patchRemoveTodo = el => state => {
  document.getElementById("todo-list").removeChild(el);
};

const patchFooter = state => {
  document.getElementById("todo-footer").firstChild.nodeValue =
    `${state.todos.length} items`;
};

// Render applies only changed patches
const render = state => (...patches) =>
  patches.forEach(patch => patch(state));

// Usage
render(state)(patchAppendTodo, patchResetTodoInput, patchFooter);
```

**Why it's elegant:**
1. **Surgical updates** - Only touch what changed
2. **Explicit data flow** - Clear which state updates which DOM
3. **No diffing** - Know exactly what to update
4. **Composable** - Patches are just functions

**Application to @lattice/view:**

Currently we use fine-grained effects:
```ts
effect(() => {
  element.className = computed();  // Re-runs when computed changes
});
```

**Could add targeted patch combinators:**
```ts
const patch = (selector: string) => (updater: (el: Element) => void) => {
  return () => {
    const el = document.querySelector(selector);
    if (el) updater(el);
  };
};

// Create reusable patches
const updateFooter = patch('#footer')(
  el => el.textContent = `${count()} items`
);

const appendTodo = patch('#todo-list')(
  list => list.appendChild(todoItem(todo()))
);

// Batch patches
batch(updateFooter, appendTodo);
```

**Benefits:**
- **Explicit** - No hidden reactivity
- **Performant** - Skip diffing, go straight to DOM
- **Debuggable** - Clear cause → effect
- **Testable** - Patches are pure functions of state

---

### 4. Symbol-Based State Change Tracking

**The Pattern:**
```javascript
const UnchangedState = Symbol("unchanged state");
const ChangedState = Symbol("changed state");

const addTodo = state => todo =>
  todo.length === 0
    ? UnchangedState
    : (state.todos.push(todo), ChangedState);

// Usage
if (addTodo(state)(todo) === ChangedState) {
  render(state)(patchAppendTodo, patchResetTodoInput, patchFooter);
}
```

**Why it's elegant:**
1. **Explicit change detection** - No hidden tracking
2. **Type-safe** - Symbols can't be accidentally created
3. **Cheap comparison** - `===` check is O(1)
4. **Intent-revealing** - Return value tells you if re-render needed

**Application to @lattice/view:**

Could add to signal API:
```ts
export const CHANGED = Symbol('changed');
export const UNCHANGED = Symbol('unchanged');

const signal = <T>(value: T) => {
  let current = value;

  const set = (newValue: T) => {
    if (newValue === current) return UNCHANGED;
    current = newValue;
    propagate();
    return CHANGED;
  };

  const get = () => current;

  return { get, set };
};

// Usage
const count = signal(0);

if (count.set(1) === CHANGED) {
  // Only run expensive update if actually changed
  updateUI();
}
```

**Benefits:**
- **Avoid unnecessary work** - Skip updates when value unchanged
- **Explicit control** - Developer decides when to check
- **Composable** - Can build higher-level change detection

---

### 5. Effect Wrapper for Lazy DOM Mutations

**The Pattern:**
```javascript
const Eff = Data("Eff")(Eff => thunk => Eff(thunk));

const appendNode = parent => child =>
  Eff(() => parent.append(child));

const insertBefore = successor => sibling =>
  Eff(() => successor.insertBefore(sibling, successor.firstChild));

// Usage
insertBefore(document.body)(todoCompo(state)).runEff();
```

**Why it's elegant:**
1. **Lazy evaluation** - Build effect tree without executing
2. **Composable** - Effects are first-class values
3. **Explicit execution** - `.runEff()` makes side effects visible
4. **Testable** - Can inspect effect tree before running

**Application to @lattice/view:**

Currently effects auto-run. Could add lazy effects:

```ts
const LazyEff = (thunk: () => void | (() => void)) => ({
  tag: 'LazyEff',
  runEff: thunk
});

const setText = (el: HTMLElement) => (text: string) =>
  LazyEff(() => { el.textContent = text; });

const addClass = (el: HTMLElement) => (className: string) =>
  LazyEff(() => { el.classList.add(className); });

// Build effect tree
const effects = [
  setText(div)('Hello'),
  addClass(div)('active'),
  setText(span)('World')
];

// Execute all at once (batch DOM updates)
effects.forEach(eff => eff.runEff());
```

**Benefits:**
- **Batch mutations** - Collect effects, run together
- **Inspection** - Debug effect tree before execution
- **Testing** - Mock `.runEff()` to verify effects without DOM
- **Optimization** - Deduplicate or reorder effects

---

### 6. Minimal Type System (3 Types Cover Everything)

**The Pattern:**
- **Event** - User interactions (click, input, etc.)
- **Behavior** - Stateful values (input.value, counter, etc.)
- **Eff** - DOM mutations (append, remove, setAttribute)

**Why it's elegant:**
1. **Complete** - Covers all reactive UI scenarios
2. **Orthogonal** - Each type has distinct role
3. **Composable** - Types compose naturally
4. **Minimal** - Just three concepts to learn

**Application to @lattice/view:**

Currently we have:
- Signal (like Behavior)
- Computed (derived Behavior)
- Effect (like Eff + Event combined)

Could simplify to:
```ts
const Reactive = {
  // Stateful value (Behavior)
  State: <T>(init: T) => ({ tag: 'State', value: init }),

  // Event stream
  Event: <T>() => ({ tag: 'Event', listeners: [] }),

  // DOM mutation (lazy)
  Mutation: (fn: () => void) => ({ tag: 'Mutation', run: fn })
};

// Clear separation
const count = Reactive.State(0);           // State
const clicks = Reactive.Event();           // Events
const updateDOM = Reactive.Mutation(() => // Mutations
  div.textContent = count.value
);
```

---

### 7. Curried Render Function for Composable Patches

**The Pattern:**
```javascript
const render = state => (...patches) =>
  patches.forEach(patch => patch(state));

// Apply multiple patches in one go
render(state)(patchAppendTodo, patchResetTodoInput, patchFooter);
```

**Why it's elegant:**
1. **Variadic** - Any number of patches
2. **Curried** - Partial application with state
3. **Sequential** - Patches run in order
4. **Composable** - Patches are functions

**Application to @lattice/view:**

Add a batch mutation helper:

```ts
const batch = <S>(state: S) => (...mutations: Array<(s: S) => void>) => {
  startBatch();
  try {
    mutations.forEach(mut => mut(state));
  } finally {
    endBatch();
  }
};

// Usage
const updateAll = batch(appState);
updateAll(
  (s) => updateCounter(s),
  (s) => updateFooter(s),
  (s) => resetInput(s)
);
```

---

## Summary: What We Should Adopt

### High Priority (Immediate Value)

1. **Curried Element Builders**
   ```ts
   const div = el('div');
   const styledDiv = div({ className: 'container' });
   styledDiv(child1, child2)
   ```
   - Reduces allocations
   - Better reusability
   - Clearer code

2. **Symbol-Based Change Tracking**
   ```ts
   if (signal.set(newValue) === CHANGED) {
     runExpensiveUpdate();
   }
   ```
   - Explicit control
   - Skip unnecessary work
   - Simple implementation

3. **Lazy Effect Wrapper**
   ```ts
   const eff = LazyEff(() => mutateDOM());
   // Later...
   eff.runEff();
   ```
   - Testability
   - Batching opportunities
   - Explicit side effects

### Medium Priority (Architectural Improvements)

4. **Targeted Patch Functions**
   - Complement existing fine-grained reactivity
   - Add for performance-critical paths
   - Use in benchmarks

5. **Closure-Based Types (ADTs)**
   - Better debugging
   - Type-safe access
   - Extensibility

### Low Priority (Nice to Have)

6. **Three-Type System**
   - Requires larger refactor
   - Current system works well
   - Consider for v2

---

## Concrete Next Steps

1. **Add curried element builders** as an alternative API
2. **Implement CHANGED/UNCHANGED symbols** for signals
3. **Create LazyEff wrapper** for testable effects
4. **Write patch combinator examples** for docs
5. **Benchmark** curried builders vs current approach

The gist demonstrates that **extreme simplicity + functional purity = maximum power**.
The entire reactive system is ~150 lines yet handles a full todo app elegantly.


# PROPOSAL

Keep it simple - fixed positions:

```ts
el(tag, props?)(child1, child2, ...)(lifecycle?)
//  ^^^^^^^^^^   ^^^^^^^^^^^^^^^^^   ^^^^^^^^^^
//  Position 1   Position 2          Position 3
```

Always three positions, lifecycle is always last:

```ts
// All children cases
el('div', { className: 'foo' })(child1, child2)(lifecycle)
el('div', { className: 'foo' })(child1, child2)()          // No lifecycle
el('div', { className: 'foo' })()(lifecycle)                // No children
el('div', { className: 'foo' })()()                         // Neither

// Can also omit props
el('div')(child1, child2)(lifecycle)
el('div')()(lifecycle)
el('div')()()
```

Type signature:
```ts
function el<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  props?: ElementProps<Tag>
) {
  return (...children: ElRefSpecChild<TElement>[]) => {
    return (lifecycle?: LifecycleCallback<HTMLElementTagNameMap[Tag]>) => {
      // Return RefSpec
    };
  };
}
```

Allocations:
- Position 1: No array (tag + props)
- Position 2: 1 array (rest params for children)
- Position 3: No array (single lifecycle callback)
- Total: 1 array per element (same as current)

Ergonomics win:

```ts
// Reusable builder
const itemDiv = el('div', { className: 'item' });

// Use many times
map(todos, (todo) =>
  itemDiv(todo.text)  // Clone with different children
);
```

Curry `map()` as well:

```ts
const itemDiv = el('div', { className: 'item' }) (
  map(todos, /** optional key fn */) ((todo) => itemDiv(todo.text))
);
```

Curry `on()` as well, taking the element as the last child instead of the first:

```ts
const onClick = on<HTMLButtonElement>('click', (e) => ...)
const itemDiv = el('div', { className: 'item' })()(onClick);

// or a one-off, no explicit typing needed:
const itemDiv = el('div', { className: 'item' })()(
  on('click', (e) => ...),
  // TODO: should el's lifecycle allow multiple params passed?
  on('mouseover', (e) => ...)
);
```