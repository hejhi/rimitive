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
