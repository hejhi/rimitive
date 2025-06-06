# Bug Report: Slice Conceptual Model Deviation

## Description

Lattice's current implementation has a fundamental conceptual bug where **slices are executing computational logic** instead of being pure shape declarations. This breaks the original design's clear separation of concerns:

1. **Slices**: Shape definition and composition only (no computation)
2. **Views**: All computation happens here (via slice execution)

## Understanding Lattice's Mental Model

### Original Design Intent

Lattice was designed with a clear separation of concerns across three phases:

#### 1. **Composition Phase** (Design Time)
When you write `createComponent()`, you're creating blueprints:
```typescript
const component = createComponent(() => {
  const model = createModel(...);  // Blueprint for state shape
  const actions = createSlice(...); // Blueprint for actions  
  const views = { ... };           // Blueprint for computed views
  return { model, actions, views };
});
```
**No execution happens here** - you're just describing the component structure.

#### 2. **Store Creation Phase** (Adapter Time)
When an adapter creates a store:
```typescript
const store = createZustandAdapter(component);
```
The adapter:
- Executes the model factory to create initial state
- Creates the underlying state management store
- Prepares slices and views for runtime execution

#### 3. **Runtime Phase** (Usage Time)
When the application runs:
```typescript
const currentView = store.views.todoList(); // Executes view computation
store.actions.addTodo('New item');          // Executes state mutation
```

### The Conceptual Problem

The current implementation **conflates three distinct concepts**:
1. Slice definition (shape declaration)
2. Slice composition (combining shapes)  
3. View computation (deriving values from state)

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

### Phase 3: View Definition and Execution (Actual Computation)

Views are where ALL computation happens. They execute slices to get shaped data, then compute derived values.

```typescript
// Component views - ALL views must be functions (even non-parameterized ones)
const views = {
  // Non-parameterized view (still needs to be a function)
  summary: () => enhancedSlice((state) => ({
    // state.todoItems is the actual Todo[] array
    visibleTodos: state.todoItems.filter(todo => {
      if (state.activeFilter === 'completed') return todo.completed;
      if (state.activeFilter === 'active') return !todo.completed;
      return true;
    }),
    count: state.todoItems.length,
    isEmpty: state.todoItems.length === 0
  })),
  
  // Parameterized view
  filtered: (threshold: number) => enhancedSlice((state) => ({
    aboveThreshold: state.todoItems.length > threshold,
    label: `Count ${state.todoItems.length} is ${state.todoItems.length > threshold ? 'above' : 'below'} ${threshold}`
  })),
  
  // View with multiple parameters
  search: (query: string, caseSensitive: boolean) => enhancedSlice((state) => ({
    results: state.todoItems.filter(item => {
      const searchIn = caseSensitive ? item.text : item.text.toLowerCase();
      const searchFor = caseSensitive ? query : query.toLowerCase();
      return searchIn.includes(searchFor);
    }),
    resultCount: state.todoItems.filter(item => {
      const searchIn = caseSensitive ? item.text : item.text.toLowerCase();
      const searchFor = caseSensitive ? query : query.toLowerCase();
      return searchIn.includes(searchFor);
    }).length
  }))
};
```

### Important: No Slice Execution Within Slices

**You cannot execute slices within other slice executions**. This maintains a clear separation:

```typescript
// ❌ WRONG: Cannot execute slices within slice execution
const badView = () => todoSlice((state) => {
  const otherData = otherSlice(state); // NOT ALLOWED! otherSlice DOESN'T take state, it takes a selector function
  return { combined: state.count + otherData.count };
});

// ✅ CORRECT: Use compose to combine slice shapes at definition time
const combinedSlice = createSlice(
  model,
  compose(
    { todo: todoSlice, other: otherSlice },
    (m, { todo, other }) => ({
      todoCount: todo.count,
      otherCount: other.count,
      // Just mapping, no computation
    })
  )
);

// Then compute in the view
const goodView = () => combinedSlice((state) => ({
  combined: state.todoCount + state.otherCount // Now we can compute!
}));
```

### Common Patterns and Anti-Patterns

```typescript
// ❌ WRONG: Returning a slice factory from a view
const badView = () => createSlice(model, (m) => ({
  // This returns a SLICE DEFINITION, not computed values!
}));

// ❌ WRONG: View defined without function wrapper
const views = {
  // This executes at definition time, not runtime!
  badView: todoSlice((state) => ({ ... }))
};

// ✅ CORRECT: All views are functions
const views = {
  goodView: () => todoSlice((state) => ({ ... })),
  paramView: (arg: string) => todoSlice((state) => ({ ... }))
};
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

1. **Clear Mental Model**: 
   - Slices = Shape definition and composition only
   - Views = All computation and derivation
   - compose() = The only way to combine slices (at definition time)

2. **Better Performance**: 
   - Slices don't compute unnecessarily
   - Views only compute what they need
   - Clear optimization boundaries

3. **True Reusability**: 
   - Slices are pure shape contracts
   - Can be composed without side effects
   - Views handle all context-specific computation

4. **Conceptual Alignment**: 
   - Matches the original Zustand-inspired design
   - No confusion about when computation happens
   - Clear separation of concerns

5. **Type Safety**: 
   - Can't accidentally compute in slice definitions
   - Mapped types make the phases explicit
   - Errors caught at compile time, not runtime

## Migration Path

This is an unreleased library, so we DO NOT need to worry about backwards compatibility. We should:

1. Update core slice implementation to return mapping tokens instead of executing selectors
2. Update compose to work with mapping tokens
3. Change slice execution to require computation callbacks
4. Ensure all views are functions (even non-parameterized ones)
5. Update tests to match the new conceptual model

Start by making one or two tests fail with the new expected behavior, then fix the implementation until they pass.

## Summary

The core issue is that we conflated three distinct concepts:

1. **Slice Definition**: Should only declare shape (what to select)
2. **Slice Composition**: Should only combine shapes (via compose)
3. **View Computation**: Should be the only place for deriving values

Currently, slices do all three, which breaks the mental model. The fix is to enforce strict boundaries:

- **Slices**: Pure shape mapping (no computation)
- **Compose**: Pure shape combination (no computation)
- **Views**: All computation happens here (and only here)

This creates a clean, predictable architecture where each part has a single, well-defined responsibility.