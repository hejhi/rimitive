# Lattice

A **headless component framework** built on Zustand. Lattice components are both the declarative contract and the actual API for your component—defining, composing, and enforcing the API surface at both the type and runtime level. Its core compositional mechanism is a composition pattern, enabling contract preservation, extensibility, and best-in-class developer experience. React‑first DX with a framework‑agnostic core.

## Core Concepts

### What is a Lattice component?

A **lattice component** is both the declarative contract and the actual API for your component:

- **API Surface**: When you define a component, you specify the API consumers will use
- **Contract Enforcement**: Composing any part changes the contract at both type and runtime levels
- **Predictable Variations**: Providing callbacks allows you to select, filter, or extend the API surface

### How Lattice Differs from Other Headless Libraries

Lattice takes a fundamentally different approach compared to traditional "headless" component libraries:

- **Attribute-Level Composition**: Views in Lattice are pure attribute maps rather than component trees. They don't represent UI hierarchy at all, just collections of properties that can be spread onto any element.

- **Rendering-System Agnostic**: Lattice completely decouples attribute generation from any rendering system, making it framework-agnostic at its core.

- **No Parent-Child Relationships**: Traditional frameworks maintain component hierarchy. Lattice views stand alone as independent attribute sets without inherent relationships.

- **Behavior Over Structure**: Lattice focuses on composing behaviors (increment, toggle, etc.) rather than structural components (Dropdown, Modal, etc.).

- **Contract-First Architecture**: The explicit contracts make Lattice more like a design system foundation than a component library, enabling type-safe composition across boundaries.

This approach enables Lattice to be used across different frameworks, platforms (native + web), and even non-UI domains that benefit from the same composition patterns.

### Rethinking Component Boundaries

Lattice presents a distinctive perspective on what constitutes a "component":

- **Components as Compositions**: Rather than rigid boundaries, components in Lattice are flexible compositions of independent elements (models, actions, selectors, views) that can be freely shared and recombined.

- **Shared Elements Across Components**: A model, set of actions, or selectors can exist across multiple "components" - enabling cross-cutting concerns that traditional component boundaries might obscure.

- **Behavioral Domains**: Components can be divided along behavioral lines (Selectable, Sortable, Draggable) rather than just UI lines (Dropdown, Modal), creating more reusable primitives.

- **Aspect-Oriented Design**: Lattice lets you define behaviors separately from where they're used, similar to aspect-oriented programming patterns.

- **Emergent Components**: What we call a "component" emerges from composition rather than being a predefined unit - more like a temporary arrangement of compatible elements that fulfills a specific need.

This approach challenges conventional component boundaries, suggesting that real-world domains are often better modeled as collections of composable behaviors that can be mixed and matched as needed.

### Lattice's Architectural Pattern

Lattice introduces an architectural pattern that could be called "MSAV" (Model-Selector-Action-View) - a novel approach that draws inspiration from established patterns like MVC, MVVM, and SAM (State-Action-Model), but with an emphasis on composition and clear separation of concerns:

| Component | Purpose                                                           | Accessibility                      | Traditional Parallel |
|-----------|-------------------------------------------------------------------|------------------------------------|----------------------|
| **Model** | Contains state and business logic (HOW)                           | Internal (composition only)        | Model in MVC, ViewModel in MVVM |
| **Actions** | Pure intent functions representing operations (WHAT)            | Internal (composition only)        | Controller in MVC, Actions in Redux/Flux |
| **Selectors** | Public read-only values and functions derived from the model  | Public (composition & consumption) | Computed Properties in MVVM |
| **View**  | Reactive representations transforming selectors into UI attributes | Public (composition & consumption) | View in MVC, but as pure data rather than components |

What distinguishes Lattice from traditional patterns is its aspect-oriented approach: each concern is modular and can be composed across traditional component boundaries. This enables separation of cross-cutting concerns (like selection state, drag-and-drop behavior, etc.) that would typically be scattered throughout a codebase.

### Mental Model & Flow

```
                   ┌───────── Contract/Reactive Models ─────────┐
                   ▼                  ▼                        ▼
View event ──▶ Actions ──▶ Model Mutation ──▶ Selectors/View update ──▶ UI re‑render
```

The flow follows a unidirectional data pattern:
1. User interactions trigger **Actions** (pure intent)
2. Actions cause **Model** mutations (state changes)
3. Model changes flow to **Selectors** (derived state)
4. Selectors update **Views** (UI attributes)
5. Views cause UI re-renders

### Composition Pattern

Components uses a factory pattern:

1. **Creation**: Factory functions create base components
   ```typescript
   const counterModel = createModel(({ set, get }) => ({
     count: 0,
     increment: () => set((state) => ({ count: state.count + 1 })),
   }));
   ```

2. **Composition**: The `from()` function

## Building Blocks

### Model – Primary Unit of Composition

Models encapsulate state and business logic, defining the contract for state and mutations. They are available for composition but not exposed to consumers.

```typescript
// Create a model with state and methods
const counterModel = createModel(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
```

### Actions – Pure Intent Functions

Actions represent WHAT should happen, delegating to model methods (HOW).

```typescript
// Create actions that delegate to model methods
const actions = createActions({ model }, ({ model }) => ({
  increment: model().increment,
  incrementTwice: model().incrementTwice,
}));
```

### Selectors – Derived Read API

Selectors provide read-only access to the model through direct properties and computed values. They form the public read API surface.

```typescript
// Create selectors for the model
const selectors = createSelectors({ model }, ({ model }) => ({
  // Direct property access
  count: model().count,
  // Computed value
  isPositive: model().count > 0,
  // Function that computes a value based on runtime input
  getFilteredItems: (filter) => model().items.filter(item => 
    item.name.includes(filter)
  ),
}));
```

### Understanding Selector Implementation

When writing expressions like `doubled: model().count * 2`, it's important to understand:

1. **At Composition Time**: This defines the structure but doesn't execute it. The `model()` function provides type-safe access to model properties.

2. **After Zustand Store Creation**:
   - In vanilla JS: Becomes a JavaScript getter that recalculates on each access
   - In React: Becomes a Zustand selector with proper reactivity

Selectors are NOT implemented as subscriptions, but as:
- JavaScript getters for vanilla JS
- Zustand's `useStore` selectors for React

### Type Safety During Composition

Lattice ensures type safety when composing components with different underlying models. TypeScript will automatically catch incompatible or missing properties:

```typescript
// Model A has count: number, title: string
const modelA = createModel(({ set, get }) => ({ 
  count: 0, 
  title: "Counter A"
}));

const selectorsA = createSelectors({ model: modelA }, ({ model }) => ({
  count: model().count,
  title: model().title,
}));

// Model B has count: number, but no title property
const modelB = createModel(({ set, get }) => ({ 
  count: 0 
  // No title property
}));
```

Similarly, TypeScript will catch type incompatibilities:

```typescript
// Model A has count as number
const modelA = createModel(({ set, get }) => ({ count: 0 }));
const selectorsA = createSelectors({ model: modelA }, ({ model }) => ({
  count: model().count, // number
}));

// Model B has count as string
const modelB = createModel(({ set, get }) => ({ count: "zero" }));
```

This type safety helps prevent runtime errors and ensures that compositions are valid.

### View – Reactive UI Attributes

Views transform selectors into UI attributes and provide interaction logic. They **only** access selectors and actions, not the model directly.

```typescript
// Create a view with UI attributes and interaction handlers
const counterView = createView({ selectors, actions }, ({ selectors, actions }) => ({
  "data-count": selectors().count,
  "aria-live": "polite",
  onClick: actions().increment,
}));

// Complex interaction logic is also supported
const advancedView = createView({ selectors, actions }, ({ selectors, actions }) => ({
  onClick: (props) => {
    if (props.shiftKey) {
      actions().incrementTwice();
    } else {
      actions().increment();
    }
  },
}));
```

## Composition Example

Components follow the same callback pattern as other factories, allowing for self-contained definitions. All component parts are defined within a single callback, creating a clean and component-like API.

```typescript
// Create a base component - all parts defined within a single callback
const counterComponent = createComponent(() => {
  // Define model with state and behavior
  const model = createModel(({ set, get }) => ({ 
    count: 0,
    increment: () => set(state => ({ count: state.count + 1 })),
    decrement: () => set(state => ({ count: state.count - 1 }))
  }));

  // Define actions that delegate to model methods
  const actions = createActions({ model }, ({ model }) => ({
    increment: model().increment,
    decrement: model().decrement
  }));

  // Define selectors that expose model properties
  const selectors = createSelectors({ model }, ({ model }) => ({
    count: model().count,
    isPositive: model().count > 0
  }));

  // Define views for UI
  const counterView = createView({ selectors }, ({ selectors }) => ({
    "data-count": selectors().count,
    "aria-live": "polite"
  }));

  const buttonView = createView({ actions }, ({ actions }) => ({
    onClick: actions().increment
  }));

  // Return the component configuration
  return {
    model,
    actions, 
    selectors,
    view: {
      counter: counterView,
      button: buttonView
    }
  };
});

// Enhanced component using composition - follows the same self-contained pattern
// When composing, dependency information can't be lost or retyped, as we compose everything and carry it
// through. Properties/methods can be overridden, but must fit the original type. The exception is the view,
// which has no dependencies, and is purely computed from state. The user can merge in any of the views
// they wish, including filtering composed views.
const enhancedComponent = createComponent(
  withComponent(counterComponent, ({ model, view, actions, selectors }) => {
    // TODO: fill in composition

    // Create new reset button view
    const resetButtonView = createView(
      { actions },
      ({ actions }) => ({
        onClick: actions().reset
      })
    );

    // Return the enhanced component configuration
    return {
      model: _model,
      actions: _actions,
      selectors: _selectors,
      view: {
        ...view,               // Keep original views
        counter: counterView,        // Override counter view
        resetButton: resetButtonView // Add new view
      }
    };
  })
);
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

3. **Subscription Support**: The architecture enables targeted subscriptions to specific slices:
   ```typescript
   // Subscribe only to relevant selector changes
   component.selectors.subscribe(
     selectors => console.log('Selectors changed:', selectors),
     selectors => [selectors.count] // Dependencies array
   )
   ```

4. **Framework Adapters**: Each framework integration gets a dedicated adapter to handle framework-specific optimizations:
   ```typescript
   // Core library - framework agnostic
   export function createComponentStore(config) {
     // Create a basic Zustand store with slices
     return createStore((set, get) => ({
       model: config.getModel(set, get),
       selectors: config.getSelectors(set, get),
       actions: config.getActions(set, get),
       views: config.getViews(set, get),
     }));
   }

   // React adapter
   export function createReactAdapter(store) {
     return {
       // React-specific optimized selectors
       useModel: (selector) => useStore(store, 
         state => selector(state.model), 
         shallow
       ),
       useSelector: (key) => useStore(store, 
         state => state.selectors[key]
       ),
       useView: (name) => useStore(store, 
         state => state.views[name], 
         shallow
       ),
       useAction: (name) => useStore(store, 
         state => state.actions[name]
       ),
     };
   }

   // Vanilla JS adapter
   export function createVanillaAdapter(store) {
     return {
       // Simpler getter-based API for vanilla JS
       getModel: () => store.getState().model,
       getSelector: (key) => store.getState().selectors[key],
       getView: (name) => store.getState().views[name],
       getAction: (name) => store.getState().actions[name],
       // Plus subscription helpers if needed
     };
   }
   ```

This implementation approach allows us to maintain the clean, compositional API surface while leveraging Zustand's performance optimizations under the hood. The framework adapters ensure that each integration can take advantage of framework-specific optimization techniques (like React's memoization) while the core library remains framework-agnostic.

## License

MIT