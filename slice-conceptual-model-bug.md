# Bug Report: Slice Conceptual Model Deviation

## Description

Lattice's current implementation has a fundamental conceptual bug where **slices are executing computational logic at definition time** instead of being pure shape declarations/selector blueprints. This breaks the original design's separation between:
1. **Composition Time**: Declaring what state to select (shape)
2. **Execution Time**: Computing derived values from that state

## Understanding Lattice's Mental Model

### Original Design Intent

Lattice was designed with a clear separation of concerns across three phases:

#### 1. **Composition Phase** (Design Time)
When you write `createComponent()`, you're creating blueprints for a component, consisting of a private model and exposed views and actions (as slice/selector definitions):
```typescript
const component = createComponent(() => {
  const model = createModel(...);  // Blueprint for state shape
  const actions = createSlice(...); // Blueprint for actions
  const views = { ... };           // Blueprint for views
  return { model, actions, views };
});
```
**Slices do not execute here** - you're just describing the component structure.

#### 2. **Store Creation Phase** (Adapter Time)
When an adapter creates a store:
```typescript
const store = createZustandAdapter(component);
```
The adapter:
- Executes the model factory to create initial state and underlying store
- Wires up the state management
- Prepares slices for execution

#### 3. **Runtime Phase** (Usage Time)
When the application runs:
```typescript
const currentView = store.views.todoList(); // Executes view computation
store.actions.addTodo('New item');          // Executes state mutation
```

### The Conceptual Problem

The current implementation **conflates slice definition with slice execution**.

## Current (Incorrect) Behavior

```typescript
// This SHOULD be a shape declaration, but it's actually computing!
const todosProcessor = createSlice(model, (m) => ({
  // ❌ These computations run every time the slice is accessed
  filteredTodos: m.todos.filter(t => !t.completed),
  stats: {
    total: m.todos.length,
    completed: m.todos.filter(t => t.completed).length
  }
}));

// When used in a view:
views: {
  processor: todosProcessor  // This re-runs ALL computations on every access
}
```

### Why This Is Wrong

1. **Breaks Slice Mental Model**: slices were inspired by Zustand slices—define state shape at store creation (they are not computed getters)
2. **Performance Issues**: Unnecessary recomputation of unused values
3. **Conceptual Confusion**: Slices are both selectors AND computed views
4. **Compose Confusion**: `compose()` seems redundant when slices already compute

## Expected (Correct) Behavior

### Phase 1: Slice Definition (Shape Declaration Only)

```typescript
// Slices should ONLY declare what parts of state they select
const todoDataSlice = createSlice(model, (m) => ({
  items: m.todos,      // NOT m.todos value, but a MAPPING to m.todos
  filter: m.filter     // Just saying "I want the filter property"
}));

// TypeScript would see:
// todoDataSlice: SliceDefinition<{ items: Mapped<Todo[]>, filter: Mapped<string> }>
```

### Phase 2: Slice Composition (Still Just Shape)

```typescript
const enhancedSlice = createSlice(
  model,
  compose(
    { myComposedSlice: todoDataSlice },
    (m, { myComposedSlice }) => ({
      todoItems: myComposedSlice.items,     // Remapping: todoItems → myComposedSlice.items → m.todos. end type would be `todoItems: Mapped<Todo[]>`
      activeFilter: myComposedSlice.filter,  // Remapping: activeFilter → myComposedSlice.filter → m.filter
      clearFn: m.clearTodos      // Direct mapping: clearFn → m.clearTodos
    })
  )
);

// Still no execution! Just building a mapping specification
```

### Phase 3: Execution Time (Actual Computation)

```typescript
// NOW we can compute with real state (and computed views can support parameters as well, what we call parameterized computed views)
const computedView = (arg1: string) => enhancedSlice((state) => {
  console.log(arg1);
  // state.todoItems is the actual Todo[] array
  return {
    visibleTodos: state.todoItems.filter(todo => {
      if (state.activeFilter === 'completed') return todo.completed;
      if (state.activeFilter === 'active') return !todo.completed;
      return true;
    }),
    count: state.todoItems.length,
    onClear: () => state.clearFn()
  };
});
```

### Executing Other Slices During Computation

During execution phase, calling other slices should work:

```typescript
const computedView = () => todoSlice((state) => {
  // ✅ This is fine - we're in execution phase with real state
  // the only _requirement_ is that the state is correctly typed for `otherSlice`
  // this should be performant as well, as executing a slice is just selecting off the model, and we should
  // be memoizing slice execution
  const otherData = otherSlice(state);
  
  return {
    count: state.items.length,
    combined: state.items.length + otherData.count
  };
});
```

This works because:
- We have real state, not mappings
- Both slices expect the same state shape
- We're computing, not defining

Note that this SHOULD NOT work, as returning `createSlice` is NOT the same as executing the slice, as see above:

```typescript
// ❌ Invalid: this would return a SLICE DEFINITION to the runtime because it's not getting live state
const badAttemptAtComputedView = () => createSlice(model, (m) => ({
  name: count.items
  // ...
}));

// ❌ Invalid: mixes up composition time and runtime. createSlice does NOT provide `state` in its callback.
// the user likely either wants to use `compose`, or call `otherSlice` in the EXECUTION phase of this slice
// when creating a VALID computed view.
const badAttemptAtComputedView = (val: string) => createSlice(model, (state) => {
  const otherSliceState = otherSlice(state);
  return {
    nameLength: state.items.length,
    onClick: () => otherSliceState.onClick(val)
    // ...
  }
});

// ✅ This is fine: a correct example of `compose` inside of `createSlice`
const enhancedSlice = createSlice(
  model,
  compose(
    { someSlice: otherSlice },
    (m, { someSlice }) => ({
      myItems: someSlice.items,
      count: m.count,
      // ...
    })
  )
);

// ✅ This is fine: a correct example of a composed, computed view using correct slice execution
const computedView = (val: string) => todoSlice((state) => {
  const otherData = otherSlice(state);
  
  return {
    count: state.items.length,
    combined: state.items.length + otherData.count,
    derivedVal: `${otherData.someVal}: ${val}`
  };
});
```

## Implementation Challenges & Solutions

### Challenge 1: Type System

**Problem**: TypeScript thinks `m.todos` returns `Todo[]`, not a mapping.

**Solution**: Use explicit mapping types:
```typescript
type Mapped<T> = { _mapped: true; _type: T };

// During definition
const slice = createSlice(model, (m: MappingProxy<Model>) => ({
  items: m.todos  // Returns Mapped<Todo[]>, not Todo[]
}));
```

### Challenge 2: Breaking Changes

**Problem**: This completely changes the API.

**Solution**: We might salvage current slice syntax for the execution phase:
```typescript
// Current syntax could become execution syntax
const view = () => todoSlice((state) => ({
  // This syntax is already perfect for execution!
  filtered: state.todos.filter(t => !t.completed)
}));
```

### Challenge 3: Nested Property Access

**Problem**: How to handle `m.user.profile.name`?

**Solution**: Only allow top-level property access in definitions:
```typescript
// ❌ Not allowed in definition
const bad = createSlice(model, (m) => ({
  name: m.user.profile.name  // Can't traverse non-existent objects
}));

// ✅ Allowed
const good = createSlice(model, (m) => ({
  user: m.user  // Top-level property only
}));

// Then in execution:
const view = () => good((state) => ({
  profileName: state.user.profile.name  // Can traverse real objects
}));
```

## Benefits of Fixing This

1. **Clear Mental Model**: Slices = shape, Views = computation
2. **Better Performance**: Only compute what's needed
3. **True Reusability**: Slices become pure data contracts
4. **Zustand Alignment**: Matches expected slice behavior
5. **Type Safety**: Can't accidentally compute in definitions

## Migration Path

This is an unreleased library, so we DO NOT need to worry about backwards compatibility. we should update one or two tests to FAIL, let them fail, then run them until they're green. This in turn should cause many other tests to fail, which will allow us to update them to match the implementation.

## Summary

The core issue is that we tricked TypeScript (and ourselves) into thinking slice definitions had access to real state. This led to an implementation where slices are simultaneously:
- Shape selectors (what they should be)
- Computed views (what they shouldn't be)

Fixing this would restore the original conceptual clarity and make Lattice's mental model much easier to understand and use correctly.