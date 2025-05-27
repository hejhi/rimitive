# Lattice

A **compositional framework** for building reusable UI behavior specifications. Lattice separates behavior definition from state management and rendering, enabling true write-once, use-anywhere components.

## Why Lattice?

Traditional component libraries couple behavior to specific frameworks and state management. Lattice introduces a new approach: define behavior as **composable specifications** that adapters can execute with any infrastructure.

```typescript
// Define behavior specification
const counter = createComponent(() => ({
  model: createModel(/* count state and increment logic */),
  selectors: createSelectors(/* derive computed values */),
  actions: createActions(/* map intents to model methods */),
  views: createViews(/* generate UI attributes */)
}));

// Adapters execute it with real infrastructure
const storeAdapter = createZustandAdapter(counter);  // Or Redux, MobX, etc.
const Component = createReactComponent(counter);     // Or Vue, Svelte, etc.
```

**Key insight**: Behavior patterns (selection, filtering, pagination) are universal. The infrastructure (React vs Vue, Redux vs Zustand) is an implementation detail.

## Core Concepts

### The layers

Lattice cleanly separates **composition** (defining behavior) from **execution** (running with real infrastructure):

1. **Composition**: Define behavior specifications by creating and composing Lattice components
2. **Adapters**: Execute specifications with actual state management and UI frameworks
3. **Runtime**: Consuming the adapters in a runtime environment

### Building Blocks

- **Model**: Encapsulates state and business logic
- **Selectors**: Derive computed values from models  
- **Actions**: Map user intents to model methods
- **Views**: Generate UI attributes from selectors and actions

### Lattice Toolkit

Powerful composition tools, like:

- **`withDerive`**: Create memoized computed values
- **`withCombine`**: Combine multiple sources into one
- **`withCompute`**: Compute on access only (not reactive, but memoized)
- **`withLens`**: Focus on nested properties (coming soon)

Composition tools can be published by authors as well.

## A Real Example: Building a Counter

Let's start with a simple counter to understand the patterns:

### Basic Counter

```typescript
import { createComponent, createModel, createSelectors, createActions, createViews } from '@lattice/core';
import { withCompute } from '@lattice/core/model'; 
import { withSelect } from '@lattice/core/selectors'; 
import { withDerive } from '@lattice/core/views';

const counter = createComponent(() => {
  // Model: State + business logic
  const model = createModel(
    withCompute(({ set, get }, { compute }) => ({
      count: 0,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 }),
      
      // Derived value in the model
      doubled: compute(() => get().count * 2)
    }))
  );
  
  // Selectors: Computed values from model
  const selectors = createSelectors(
    model,
    withSelect((model, { select }) => ({
      count: model.count,
      doubled: model.doubled,
      
      // Selector-specific derivation  
      isEven: select(model.count, (count) => count % 2 === 0),
      message: select(model.count, (count) => `Count is ${count}`)
    }))
  );
  
  // Actions: User intents mapped to model methods (should be a logic-less, direct mapping)
  const actions = createActions(model, ({ increment, decrement }) => ({
    increment,
    decrement,
  }));
  
  // Views: UI attributes from selectors and actions
  const views = createViews(
    { selectors, actions },
    withDerive(({ selectors, actions }, { derive }) => ({
      counter: derive(
        ({ selectors }) => ({
          count: selectors.count,
          message: selectors.message,
          isEven: selectors.isEven
        }),
        ({ count, message, isEven }) => () => ({
          'data-count': count,
          'aria-label': message,
          className: isEven ? 'even' : 'odd'
        })
      ),
      
      incrementButton: derive(
        ({ selectors, actions }) => ({
          increment: actions.increment,
          count: selectors.count
        }),
        ({ increment, count }) => () => ({
          onClick: increment,
          disabled: count >= 10,
          'aria-label': 'Increment counter'
        })
      ),
      
      decrementButton: derive(
        ({ selectors, actions }) => ({
          decrement: actions.decrement,
          count: selectors.count
        }),
        ({ decrement, count }) => () => ({
          onClick: decrement,
          disabled: count <= 0,
          'aria-label': 'Decrement counter'
        })
      )
    }))
  );
  
  return { model, selectors, actions, views };
});

```

## More Examples

### Parameterized Views

Views can accept runtime parameters for dynamic UI generation:

```typescript
const todoList = createComponent(() => {
  const model = createModel(
    withCompute(({ set, get }, { compute }) => ({
      todos: [],
      filter: 'all', // 'all' | 'active' | 'completed'
      
      addTodo: (text: string) => {
        const newTodo = { id: Date.now(), text, completed: false };
        set({ todos: [...get().todos, newTodo] });
      },
      
      toggleTodo: (id: number) => {
        set({
          todos: get().todos.map(todo =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          )
        });
      },
      
      visibleTodos: compute(() => {
        const { todos, filter } = get();
        if (filter === 'active') return todos.filter(t => !t.completed);
        if (filter === 'completed') return todos.filter(t => t.completed);
        return todos;
      })
    }))
  );
  
  const selectors = createSelectors(
    model,
    withSelect((model, { select }) => ({
      todos: model.visibleTodos,
      filter: model.filter,
      todoCount: select(model.visibleTodos, (visibleTodos) => visibleTodos.length),
      hasCompleted: select(model.visibleTodos, (visibleTodos) => visibleTodos.some(t => t.completed))
    }))
  );

  const views = createViews(
    { selectors, actions },
    withDerive(({ selectors, actions }, { derive }) => ({
      // Parameterized view for individual todos
      todoItem: derive(
        ({ selectors, actions }) => ({
          todos: selectors.todos,
          toggle: actions.toggle,
        }),
        ({ todos, toggle }) => (todoId: number) => {
          const todo = todos.find(t => t.id === todoId);
          return {
            className: todo?.completed ? 'completed' : 'active',
            onClick: () => toggle(todoId),
            'aria-checked': todo?.completed
          };
        }
      ),
      
      // View with multiple parameters
      filterButton: derive(
        ({ selectors, actions }) => ({
          filter: selectors.filter,
          setFilter: actions.setFilter,
        }),
        ({ filter, setFilter }) => (filterType: 'all' | 'active' | 'completed') => ({
          className: filter === filterType ? 'selected' : '',
          onClick: () => setFilter(filterType),
          'aria-pressed': filter === filterType
        })
      )
    }))
  );
  
  return { model, selectors, actions, views };
});

```

### Extracting Complex Views

For complex views, it's often cleaner to extract the view creation logic:

```typescript
// Extract complex view logic for clarity
const createTodoItemView = ({ todos, toggle }) => (todoId: number) => {
  const todo = todos.find(t => t.id === todoId);
  return {
    className: todo?.completed ? 'completed' : 'active',
    onClick: () => toggle(todoId),
    'aria-checked': todo?.completed
  };
};

const views = createViews(
  { selectors, actions },
  withDerive(({ selectors, actions }, { derive }) => ({
    // Clean and readable
    todoItem: derive(
      ({ selectors, actions }) => ({
        todos: selectors.todos,
        toggle: actions.toggle,
      }),
      createTodoItemView
    )
  }))
);
```

This pattern keeps your view definitions clean while maintaining full type safety.

### Component Composition

Lattice's composition system lets you build complex behaviors from simple ones:

```typescript
import { createComponent, withComponent, withDerive, withCombine } from '@lattice/core';

// Base counter from above
const counter = createComponent(() => {
  // ... counter implementation
});

// Enhance with persistence
const persistentCounter = createComponent(
  withComponent(counter, ({ model, selectors, actions, views }) => {
    // Enhanced model adds persistence
    const enhancedModel = createModel(
      withCompute(({ set, get }, { compute }) => ({
        // Compose the base model - explicitly pass tools
        ...model()({ set, get }, { compute }),
        
        // Add new capability
        lastSaved: Date.now(),
        save: () => {
          localStorage.setItem('count', String(get().count));
          set({ lastSaved: Date.now() });
        }
      }))
    );
    
    // Enhanced selectors with save status
    const enhancedSelectors = createSelectors(
      enhancedModel,
      withCombine((model, { combine }) => ({
        // In this scenario, the sub-selectors doesn't require `combine`, so we don't need to pass anything
        // as the second param
        ...selectors()(model),
        
        // Add new computed values
        saveStatus: combine(
          () => model.lastSaved,
          () => Date.now(),
          (lastSaved, now) => {
            const secondsAgo = Math.floor((now - lastSaved) / 1000);
            return secondsAgo > 60 ? 'unsaved changes' : 'saved';
          }
        )
      }))
    );
    
    // Enhanced actions
    const enhancedActions = createActions(
      enhancedModel,
      ({ model }) => ({
        ...actions()({ model }),
        someNewMethod: model.someNewMethod
      })
    );
    
    // Enhanced views
    const enhancedViews = createViews(
      { selectors: enhancedSelectors, actions: enhancedActions },
      withDerive(({ selectors, actions }, { derive }) => ({
        ...views()({ selectors, actions }, { derive }),
        
        saveButton: derive(
          ({ selectors, actions }) => ({
            incrementAndSave: actions.incrementAndSave,
            saveStatus: selectors.saveStatus
          }), 
          ({ incrementAndSave, saveStatus }) => () => ({
            onClick: incrementAndSave,
            'aria-label': 'Save counter',
            className: saveStatus === 'unsaved changes' ? 'warning' : ''
          })
        )
      }))
    );
    
    return {
      model: enhancedModel,
      selectors: enhancedSelectors,
      actions: enhancedActions,
      views: enhancedViews
    };
  })
);

```

## Key Principles

### 1. **Explicit Tool Usage**
Every factory declares exactly what tools it needs:

```typescript
// Clear tool dependencies
const model = createModel(
  withCompute(({ set, get }, { derive }) => ({
    // Model has derive available
  }))
);

const selectors = createSelectors(
  model,
  withCombine((model, { combine }) => ({
    // Selectors have combine available
  }))
);
```

### 2. **Clean Model References in Selectors**
Selectors receive model properties directly, avoiding top-level state access:

```typescript
// Model properties can be destructured
const selectors = createSelectors(
  model,
  withSelect(({ count, filter, todos }, { select }) => ({
    // Direct references - no function calls
    count,
    filter,
    
    // Computations use derive with selector state
    isEven: select(count, (countVal) => countVal % 2 === 0),
    summary: select(todos, (todosVal) => `${todosVal.length} items`)
  }))
);
```

This pattern ensures:
- No stale state captures (no `model()` calls at top level)
- Clear distinction between references and computations
- Consistent with model's `get()` pattern inside `compute()`

### 3. **Composition Over Inheritance**
When composing, you explicitly pass tools through:

```typescript
const enhanced = createModel(
  withCompute(({ set, get }, { compute }) => ({
    // Must explicitly pass derive to base model
    ...baseModel()({ set, get }, { compute }),
    // Add enhancements
  }))
);
```

### 4. **Clean Separation of Concerns**
- **Models**: Own state and business logic
- **Selectors**: Compute derived values
- **Actions**: Map intents to model methods
- **Views**: Generate UI attributes

### 5. **Type-Safe Contracts**
TypeScript ensures all contracts are satisfied at compile time:

```typescript
// Type error if model doesn't provide required properties
const selectors = createSelectors(
  model, // Must satisfy model contract
  ({ count }) => ({
    // TypeScript knows model shape through destructuring
    count
  })
);
```

## The Power of Composition

Lattice's compositional approach enables powerful patterns:

### Behavior Libraries

Instead of framework-specific component libraries, create behavior specifications:

```typescript
// @awesome-ui/behaviors
export const DataGrid = createComponent(() => ({
  model: createModel(withCompute(/* filtering, sorting, pagination */)),
  selectors: createSelectors(/* visible rows, sort indicators */),
  actions: createActions(/* sort, filter, paginate */),
  views: createViews(/* table, headers, cells, pagination */)
}));

// Users adapt to their needs
const MyDataGrid = createComponent(
  withComponent(DataGrid, (base) => ({
    // Add custom features
    model: createModel(withCompute(({ set, get }, { compute }) => ({
      ...base.model()({ set, get }, { compute }),
      // Add Excel export
      exportToExcel: () => { /* ... */ }
    })))
  }))
);
```

### Cross-Cutting Concerns

Build reusable behaviors that work across different components:

```typescript
// Selectable behavior
const withSelection = <T extends { id: string }>(
  model: ModelFactory<{ items: T[] }>
) => createModel(
  withCompute(({ set, get }, { compute }) => ({
    ...model()({ set, get }, { compute }),
    selectedIds: new Set<string>(),
    
    selectItem: (id: string) => {
      const selected = new Set(get().selectedIds);
      selected.add(id);
      set({ selectedIds: selected });
    },
    
    selectedItems: compute(() => 
      get().items.filter(item => get().selectedIds.has(item.id))
    )
  }))
);

// Apply to any component with items
const selectableList = withSelection(listModel);
const selectableTree = withSelection(treeModel);
const selectableGrid = withSelection(gridModel);
```

---

**Core Philosophy**: UI complexity isn't about rendering. It's about behavior. Lattice lets you solve behavior once and use it everywhere.