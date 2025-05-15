# Lattice

A **headless component framework** built on Zustand. Lattice components are both the declarative contract and the actual API for your component—defining, composing, and enforcing the API surface at both the type and runtime level. Its core compositional mechanism is a fluent composition pattern with `.with()` method, enabling contract preservation, extensibility, and best-in-class developer experience. React‑first DX with a framework‑agnostic core.

## Core Concepts

### What is a Lattice component?

A **lattice component** is both the declarative contract and the actual API for your component:

- **API Surface**: When you define a component, you specify the API consumers will use
- **Contract Enforcement**: Composing any part changes the contract at both type and runtime levels
- **Predictable Variations**: Providing callbacks allows you to select, filter, or extend the API surface

### Mental Model & Flow

```
                   ┌───────── Contract/Reactive Models ─────────┐
                   ▼                  ▼                        ▼
View event ──▶ Actions ──▶ Model Mutation ──▶ Selectors/View update ──▶ UI re‑render
```

| Component | Purpose                                                           | Accessibility                      |
|-----------|-------------------------------------------------------------------|------------------------------------|
| **Model** | Contains state and business logic (HOW)                           | Internal (composition only)        |
| **Actions** | Pure intent functions representing operations (WHAT)            | Internal (composition only)        |
| **Selectors** | Public read-only values and functions derived from the model  | Public (composition & consumption) |
| **View**  | Reactive representations transforming selectors into UI attributes | Public (composition & consumption) |

### Composition Pattern

Components uses a factory pattern:

1. **Creation**: Factory functions create base components
   ```typescript
   const counterModel = createModel((set, get) => ({
     count: 0,
     increment: () => set((state) => ({ count: state.count + 1 })),
   }));
   ```

2. **Composition**: The `.with()` method adds new properties or behaviors
   ```typescript
   const enhancedModel = createModel(
    compose(counterModel).with((set, get, slice) => ({
      ...slice,
      incrementTwice: () => {
        get().increment();
        get().increment();
      },
    }))
  )
   ```

## Building Blocks

### Model – Primary Unit of Composition

Models encapsulate state and business logic, defining the contract for state and mutations. They are available for composition but not exposed to consumers.

```typescript
// Create a model with state and methods
const counterModel = createModel((set, get) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));

// progressively compose in new behavior
const enhancedModel = createModel(
  compose(counterModel).with((set, get, slice) => ({
    ...slice,
    incrementTwice: () => {
      get().increment();
      get().increment();
    },
  }))
);
```

### Actions – Pure Intent Functions

Actions represent WHAT should happen, delegating to model methods (HOW).

```typescript
// Create actions that delegate to model methods
const actions = createActions(model, (getModel) => ({
  increment: getModel().increment,
  incrementTwice: getModel().incrementTwice,
}));
```

### Selectors – Derived Read API

Selectors provide read-only access to the model through direct properties and computed values. They form the public read API surface.

```typescript
// Create selectors for the model
const selectors = createSelectors(model, (getModel) => ({
  // Direct property access
  count: getModel().count,
  // Computed value
  isPositive: getModel().count > 0,
  // Function that computes a value based on runtime input
  getFilteredItems: (filter) => getModel().items.filter(item => 
    item.name.includes(filter)
  ),
}));

// Compose to add more derived values
const enhancedSelectors = createSelectors(
  model,
  compose(selectors).with((getModel, slice) => ({
    ...slice,
    doubled: getModel().count * 2,
    formatted: `Count: ${getModel().count}`,
  }))
);
```

### Type Safety During Composition

Lattice ensures type safety when composing components with different underlying models. TypeScript will automatically catch incompatible or missing properties:

```typescript
// Model A has count: number, title: string
const modelA = createModel(() => ({ 
  count: 0, 
  title: "Counter A"
}));

const selectorsA = createSelectors(modelA, (getModel) => ({
  count: getModel().count,
  title: getModel().title,
}));

// Model B has count: number, but no title property
const modelB = createModel(() => ({ 
  count: 0 
  // No title property
}));

// This would cause a TypeScript error - title property doesn't exist on modelB
const selectorsB = createSelectors(
  modelB,
  compose(selectorsA).with((getModel, slice) => ({
    ...slice,  // Error: Property 'title' is accessed but doesn't exist on modelB
    doubled: getModel().count * 2,
  }))
);

// Correct approach - manually select compatible properties
const selectorsB = createSelectors(
  modelB,
  compose(selectorsA).with((getModel, slice) => ({
    count: slice.count,  // Only include properties that exist in both
    doubled: getModel().count * 2,
  }))
);
```

Similarly, TypeScript will catch type incompatibilities:

```typescript
// Model A has count as number
const modelA = createModel(() => ({ count: 0 }));
const selectorsA = createSelectors(modelA, getModel => ({
  count: getModel().count, // number
}));

// Model B has count as string
const modelB = createModel(() => ({ count: "zero" }));

// This would cause a TypeScript error - incompatible types
const selectorsB = createSelectors(
  modelB,
  compose(selectorsA).with((getModel, slice) => ({
    ...slice,  // Error: Type 'number' is not assignable to type 'string'
    formatted: `Count: ${getModel().count}`,
  }))
);
```

This type safety helps prevent runtime errors and ensures that compositions are valid.

### View – Reactive UI Attributes

Views transform selectors into UI attributes and provide interaction logic. They **only** access selectors and actions, not the model directly.

```typescript
// Create a view with UI attributes and interaction handlers
const counterView = createView(selectors, actions, (getSelectors, getActions) => ({
  "data-count": getSelectors().count,
  "aria-live": "polite",
  onClick: getActions().increment,
}));

// Complex interaction logic is also supported
const advancedView = createView(selectors, actions, (getSelectors, getActions) => ({
  onClick: (props) => {
    if (props.shiftKey) {
      getActions().incrementTwice();
    } else {
      getActions().increment();
    }
  },
}));
```

## Composition Example

```typescript
// Create a base lattice
const createCounterLattice = () => {
  // Define model with state and behavior
  const model = createModel((set, get) => ({ count: 0 }));

  // compose a base model to augment it
  const enhancedModel = createModel(compose(model).with((set, get, slice) => ({
    ...slice,
    // `count` is accessible in getters and setters, as is countMultiplied
    countMultiplied: get().count * 2,
    increment: () => set((state) => ({ count: state.count + 1 })),
    decrement: () => set((state) => ({ count: state.count - 1 })),
  })))

  // Define actions that delegate to enhancedModel
  const actions = createActions(enhancedModel, (getModel) => ({
    increment: getModel().increment,
    decrement: getModel().decrement,
  }));

  // Define selectors that expose model properties
  const selectors = createSelectors(enhancedModel, (getModel) => ({
    count: getModel().count,
    isPositive: getModel().count > 0,
  }));

  // Define views for UI
  const counterView = createView(selectors, null, (getSelectors) => ({
    "data-count": getSelectors().count,
    "aria-live": "polite",
  }));

  const buttonView = createView(null, actions, (null, getActions) => ({
    onClick: getActions().increment,
  }));

  // Return the lattice component
  return createComponent({
    // if the user had provided a selectors/view/action that referenced a different model,
    // there would be a type error
    model: enhancedModel,
    actions, 
    selectors,
    view: {
      counter: counterView,
      button: buttonView,
    },
  });
};

// Create an enhanced component from the base component
const createEnhancedComponent = (baseComponent) => {
  // Enhance the model with new functionality
  const model = createModel(compose(baseComponent).with((set, get, slice) => ({
    ...slice,
    incrementTwice: () => {
      get().increment();
      get().increment();
    },
    reset: () => get().set({ count: 0 }),
  })));

  const actions = createActions(
    model,
    compose(baseComponent).with((getModel, slice) => ({
      // cherry-pick properties from slice
      ...slice,
      incrementTwice: getModel().incrementTwice,
      reset: getModel().reset,
    }))
  );

  const selectors = createSelectors(
    model, 
    compose(baseComponent).with((getModel, slice) => ({
      ...slice,
      doubled: getModel().count * 2,
      isEven: getModel().count % 2 === 0,
    }))
  );

  // both selectors and actions are optional
  const view = createView(
    selectors,
    null,
    compose(baseComponent.getView('counter')).with((getSelectors, _, slice) => ({
        ...slice,
        "data-doubled": getSelectors().doubled,
        "data-even": getSelectors().isEven,
      }),
    )
  );

  const resetButton = createView(null, actions, (_, getActions) => ({
    onClick: getActions().reset
  }))

  return createComponent({
    model,
    actions,
    selectors,
    view: {
      ...baseComponent.getViews(),  // Keep original views
      counter: view,                // Override with enhanced view
      resetButton,                  // Add new view
    },
  });
};
```

## Implementation Notes

### Slices-Based Architecture

Internally, Lattice components use a slices pattern to implement its compositional model while maintaining Zustand's performance benefits, creating a single zustand store:

```typescript
// Internal representation - all parts become slices of a single store
export const createComponentStore = (config) => create((...a) => ({
  model: config.getModel(...a),      // Model slice with internal state and methods
  selectors: config.getSelectors(...a), // Selectors with computed values
  views: config.getViews(...a),      // View slices for UI attributes
  actions: config.getActions(...a),  // Actions slice for intent methods
}))
```

### Key Implementation Details

1. **Property Prefixing**: Each slice's properties are prefixed in the actual store (e.g., `model.count`, `selectors.isPositive`) to prevent collisions

2. **Selector Generation**: We'll adapt Zustand's auto-generated selectors pattern for both React and vanilla JS environments. Pseudocode example:
  ```typescript
  // selectorHelpers.ts
  import { UseStore } from 'zustand/vanilla';
  import { shallow } from 'zustand/shallow';

  type StoreShape = {
    model: unknown;
    selectors: Record<string, unknown>;
    views: Record<string, object>;
    actions: Record<string, (...args: any[]) => void>;
  };

  export function createStoreSelectors<T extends StoreShape>(store: UseStore<T>) {
    return {
      // Selectors (primitive values)
      selector: (key: keyof T['selectors']) => 
        useStore(store, (s) => s.selectors[key]),
        
      // View namespace selectors (objects with shallow compare)
      view: <K extends keyof T['views']>(namespace: K) =>
        useStore(store, (s) => s.views[namespace], shallow),
        
      // Action selector (stable function references)
      action: <K extends keyof T['actions']>(name: K) =>
        useStore(store, (s) => s.actions[name])
    };
  }

  // store.ts
  import { createStore } from 'zustand/vanilla';

  type Model = { count: number; theme: 'light' | 'dark' };
  type Selectors = { count: number; isEven: boolean };
  type Views = { label: object; button: object };
  type Actions = { increment: () => void; toggleTheme: () => void };

  const store = createStore<Model & Selectors & Views & Actions>((set, get) => ({
    // Model (private)
    model: { count: 0, theme: 'light' },
    
    // Selectors (computed)
    get selectors() {
      return {
        count: get().model.count,
        isEven: get().model.count % 2 === 0
      };
    },
    
    // Views (namespaced, computed)
    get views() {
      return {
        label: {
          'aria-label': `Count: ${get().selectors.count}`,
          'data-theme': get().model.theme
        },
        button: {
          onClick: () => get().actions.increment(),
          style: { 
            color: get().model.theme === 'dark' ? 'white' : 'black' 
          }
        }
      };
    },
    
    // Actions (model mutators)
    actions: {
      increment: () => set(state => ({
        model: { ...state.model, count: state.model.count + 1 }
      })),
      toggleTheme: () => set(state => ({
        model: { 
          ...state.model, 
          theme: state.model.theme === 'light' ? 'dark' : 'light' 
        }
      }))
    }
  }));

  export const { selector, view, action } = createStoreSelectors(store);

  // example in React adaptor
  function Counter() {
    const count = selector('count');
    const isEven = selector('isEven');
    const labelProps = view('label');
    const buttonProps = view('button');
    const increment = action('increment');
    const toggleTheme = action('toggleTheme');

    return (
      <div {...labelProps}>
        <button {...buttonProps} onClick={increment}>
          Count: {count} ({isEven ? 'even' : 'odd'})
        </button>
        <button onClick={toggleTheme}>Toggle Theme</button>
      </div>
    );
  }
  ```
  - selector() uses strict equality (primitives)
  - view() uses shallow comparison (objects)
  - action() returns stable function references

3. **Type-Safe Composition**: The implementation leverages TypeScript's type inference system:
   ```typescript
   // Implementation of compose() with strong typing
   function compose<BaseType>(base: BaseType) {
     return {
       // User only needs to specify return type, model type is inferred
       with<ReturnType, ModelType = InferModelType<BaseType>>(
         cb: (getModel: () => ModelType, slice: BaseType) => ReturnType
       ): ReturnType {
         // Implementation details...
       }
     };
   }
   
   // Type inference for models used in selectors
   type InferModelType<T> = T extends { __MODEL_TYPE__: infer M } ? M : never;
   ```
   
   The type system automatically:
   - Infers model types from selectors
   - Prevents incompatible property access
   - Flags type mismatches during composition
   - Requires explicit handling for missing properties

4. **Subscription Support**: The architecture enables targeted subscriptions to specific slices:
   ```typescript
   // Subscribe only to relevant selector changes
   component.selectors.subscribe(
     selectors => console.log('Selectors changed:', selectors),
     selectors => [selectors.count] // Dependencies array
   )
   ```

This implementation approach allows us to maintain the clean, compositional API surface while leveraging Zustand's performance optimizations under the hood.

## License

MIT