# Bug Report: Slice Conceptual Model Deviation

## Description

Lattice's current implementation has a fundamental conceptual bug where **slices are executing computational logic** instead of being pure shape declarations. This breaks the original design's clear separation of concerns:

1. **Slices**: Shape definition and composition only (no computation)
2. **Views**: All computation happens here (via slice execution)

## Understanding Lattice's Mental Model

### Original Design Intent

Lattice was designed with a clear separation of concerns across three phases:

#### 1. **Composition Phase** (Design Time)
```typescript
const component = () => {
  const model = createModel(...);  // Blueprint for state shape
  const actions = createSlice(...); // Blueprint for actions  
  const views = { ... };           // Blueprint for computed views
  return { model, actions, views };
};
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
// todoDataSlice: SliceFactory<Model, { items: Todo[], filter: string }>
```

### Phase 2: Slice Composition (Still Just Shape)

```typescript
const enhancedSlice = createSlice(
  model,
  compose(
    { myComposedSlice: todoDataSlice },
    (m, { myComposedSlice }) => ({
      todoItems: myComposedSlice.items,     // Remapping: todoItems → myComposedSlice.items → m.todos
      activeFilter: myComposedSlice.filter,  // Remapping: activeFilter → myComposedSlice.filter → m.filter
      clearFn: m.clearTodos      // Direct mapping: clearFn → m.clearTodos
    })
  )
);

// Still no execution! Just building a mapping specification
```

### Phase 3: View Definition and Execution (Actual Computation)

Views are where ALL computation happens. They execute slices to get shaped data, then compute derived values. Views should use the `compute` function to make their role explicit.

```typescript
// Computed views using the compute function
export const summary = compute(() => enhancedSlice((state) => ({
  // state.todoItems is the actual Todo[] array
  visibleTodos: state.todoItems.filter(todo => {
    if (state.activeFilter === 'completed') return todo.completed;
    if (state.activeFilter === 'active') return !todo.completed;
    return true;
  }),
  count: state.todoItems.length,
  isEmpty: state.todoItems.length === 0
})));

// Parameterized computed view
export const filtered = compute((threshold: number) => enhancedSlice((state) => ({
  aboveThreshold: state.todoItems.length > threshold,
  label: `Count ${state.todoItems.length} is ${state.todoItems.length > threshold ? 'above' : 'below'} ${threshold}`
})));

// Computed view with multiple parameters
export const search = compute((query: string, caseSensitive: boolean) => 
  enhancedSlice((state) => ({
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
);
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
const goodView = compute(() => combinedSlice((state) => ({
  combined: state.todoCount + state.otherCount // Now we can compute!
})));
```

### Common Patterns and Anti-Patterns

```typescript
// ❌ WRONG: Returning a slice factory from a view
const badView = compute(() => createSlice(model, (m) => ({
  // This returns a SLICE DEFINITION, not computed values!
})));

// ❌ WRONG: Missing compute wrapper
const badView = () => todoSlice((state) => ({ ... }));

// ❌ WRONG: Not wrapping in `compute`
const badView = todoSlice((state) => ({ ... }));

// ✅ CORRECT: Using compute for all views
const goodView = compute(() => todoSlice((state) => ({ ... })));
const paramView = compute((arg: string) => todoSlice((state) => ({ ... })));
```

## Implementation Challenges & Solutions

### Challenge 1: Type System

**Problem**: TypeScript thinks `m.todos` returns `Todo[]`, not a shape declaration.

**Solution**: Use a simple `SliceDefinition<T>` wrapper that carries the final type:
```typescript
// The SliceDefinition type just wraps the shape being selected
type SliceDefinition<T> = { _shape: T };

// During slice creation, properties return SliceDefinition types
const todoSlice = createSlice(model, (m) => ({
  items: m.todos,      // Type: SliceDefinition<Todo[]>
  filter: m.filter     // Type: SliceDefinition<string>
}));
// todoSlice type: SliceFactory<Model, { items: Todo[], filter: string }>

// When composing, types flow naturally
const dashboardSlice = createSlice(
  model,
  compose(
    { todo: todoSlice },
    (m, { todo }) => ({
      todoItems: todo.items,    // Type: SliceDefinition<Todo[]>
      activeFilter: todo.filter  // Type: SliceDefinition<string>
    })
  )
);
// dashboardSlice type: SliceFactory<Model, { todoItems: Todo[], activeFilter: string }>

// At execution time, SliceDefinition is unwrapped to actual values
const view = compute(() => dashboardSlice((state) => ({
  // state.todoItems is Todo[], not SliceDefinition<Todo[]>
  count: state.todoItems.length,
  // state.activeFilter is string, not SliceDefinition<string>
  label: `Filter: ${state.activeFilter}`
})));
```

The key insight: `SliceDefinition<T>` carries the **final type** through all compositions without complex transformations.

### Challenge 2: Breaking Changes

**Problem**: This completely changes the API.

**Solution**: We might salvage current slice syntax for the execution phase:
```typescript
// Current syntax below could become execution syntax (just wrapped in `compute`)
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
const view = compute(() => good((state) => ({
  profileName: state.user.profile.name  // Can traverse real objects
})));
```

## Module-Based Component Architecture

With the corrected model, components naturally become modules rather than factory functions:

```typescript
// counter.ts - Module-based component
import { createModel, createSlice, compose, compute } from '@lattice/core';

// Model definition
export const model = createModel<{
  count: number;
  increment: () => void;
  decrement: () => void;
}>(({ set, get }) => ({
  count: 0,
  increment: () => set({ count: get().count + 1 }),
  decrement: () => set({ count: get().count - 1 })
}));

// Public slices (can be composed by other modules)
export const countSlice = createSlice(model, (m) => ({
  count: m.count
}));

// Private slices (internal use only)
const internalSlice = createSlice(model, (m) => ({
  // Internal shape not exposed
}));

// Actions slice
export const actions = createSlice(model, (m) => ({
  increment: m.increment,
  decrement: m.decrement  
}));

// Computed views
export const display = compute(() => countSlice((state) => ({
  value: state.count,
  label: `Count: ${state.count}`
})));

export const threshold = compute((min: number) => countSlice((state) => ({
  isAbove: state.count > min,
  message: state.count > min ? 'Above threshold' : 'Below threshold'
})));
```

### Composing Module-Based Components

```typescript
// persistent-counter.ts
import * as counter from './counter';
import { createModel, createSlice, compose, compute } from '@lattice/core';

// Extend the model
export const model = createModel<{
  count: number;
  increment: () => void;
  decrement: () => void;
  lastSaved: number;
  save: () => void;
}>(({ set, get }) => ({
  ...counter.model({ set, get }), // Execute base model
  lastSaved: Date.now(),
  save: () => {
    localStorage.setItem('count', String(get().count));
    set({ lastSaved: Date.now() });
  }
}));

// Reuse base slices - they still work with extended model!
export { countSlice, actionsSlice } from './counter';

// New slices for extended functionality
export const saveSlice = createSlice(model, (m) => ({
  lastSaved: m.lastSaved
}));

// Compose slices
export const dashboardSlice = createSlice(
  model,
  compose(
    { count: counter.countSlice, save: saveSlice },
    (m, { count, save }) => ({
      currentCount: count.count,
      lastSaved: save.lastSaved,
    })
  )
);

// Actions
export const actions = createSlice(model, compose({ actionsSlice }, (m, { actionsSlice }) => ({
  ...actionsSlice,
  save: m.save
})));

// Computed views - compose by importing
export { display, threshold } from './counter';

export const saveIndicator = compute(() => saveSlice((state) => ({
  className: Date.now() - state.lastSaved > 60000 ? 'warning' : 'success',
  textContent: Date.now() - state.lastSaved > 60000 ? 'unsaved' : 'saved'
})));
```

## Benefits of Fixing This

1. **Clear Mental Model**: 
   - `createModel` = State structure definition
   - `createSlice` = Shape mapping (with `compose` for combining)
   - `compute` = Value derivation and transformation
   - Each function has ONE clear purpose

2. **Better Performance**: 
   - Slices don't compute unnecessarily
   - Views only compute what they need
   - Clear optimization boundaries

3. **Natural Module Composition**: 
   - Standard ES6 imports/exports
   - Selective exposure (public vs private)
   - Explicit dependencies
   - No factory function overhead

4. **Conceptual Alignment**: 
   - Matches the original Zustand-inspired design
   - Clear separation between structure and computation
   - Predictable execution model

5. **Type Safety**: 
   - Can't accidentally compute in slice definitions
   - Mapped types make the phases explicit
   - Errors caught at compile time, not runtime

## Migration Path

This is an unreleased library, so we DO NOT need to worry about backwards compatibility. We should:

1. Add the `compute` function to core exports
2. Update slice implementation to return mapping tokens instead of executing selectors
3. Update compose to work with mapping tokens
4. Change slice execution to require computation callbacks
5. Update all examples to use the module pattern
6. Update tests to match the new conceptual model

Start by making one or two tests fail with the new expected behavior, then fix the implementation until they pass.

## Summary

The core issue is that we conflated three distinct concepts:

1. **Slice Definition**: Should only declare shape (what to select)
2. **Slice Composition**: Should only combine shapes (via compose)
3. **View Computation**: Should be the only place for deriving values

Currently, slices do all three, which breaks the mental model. The fix is to enforce strict boundaries:

```typescript
// Clear separation of concerns
createModel()  // → Define state structure
createSlice()  // → Map state shape (no computation)
compose()      // → Combine slice shapes (no computation)
compute()      // → Derive values from state (all computation)
```

This creates a clean, predictable architecture where:
- Each function has a single, well-defined purpose
- Components are modules, not factory functions
- Composition happens naturally through ES6 imports
- The execution model is clear and predictable