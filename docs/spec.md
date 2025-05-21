# Lattice

A **headless component framework** that lets you build reusable UI behaviors once and use them everywhere. Lattice components are behavior specifications, not UI - they work across React, Vue, vanilla JS, and any rendering system. Built on Zustand for performance, with a framework-agnostic core that enables contract preservation, extensibility, and best-in-class developer experience.

## Core Concepts

### What is a Lattice component?

A **lattice component** is a behavior specification that defines reusable UI logic:

- **Behavior as Data**: Components generate pure attribute objects that can be spread onto any element
- **Framework Agnostic**: The same component works across React, Vue, vanilla JS, and any rendering system
- **Progressive Composition**: Start simple and layer on complexity without breaking existing functionality
- **Type-Safe Contracts**: Full TypeScript support ensures safe composition and consumption

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

Lattice introduces an architectural pattern that could be called "VSAM" (View-Selector-Action-Model) - a novel approach that draws inspiration from established patterns like MVC, MVVM, and SAM (State-Action-Model), but with an emphasis on composition, progressive enhancement, and framework-agnostic reusability:

| Component | Purpose                                                           | Accessibility                      | Traditional Parallel |
|-----------|-------------------------------------------------------------------|------------------------------------|----------------------|
| **View**  | Reactive representations transforming selectors into UI attributes | Public (composition & consumption) | View in MVC, but as pure data rather than components |
| **Selectors** | Public read-only values and functions derived from the model  | Public (composition & consumption) | Computed Properties in MVVM |
| **Actions** | Pure intent functions representing operations (WHAT)            | Internal (composition only)        | Controller in MVC, Actions in Redux/Flux |
| **Model** | Contains state and business logic (HOW)                           | Internal (composition only)        | Model in MVC, ViewModel in MVVM |

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

Lattice uses a fluent API composition pattern centered around the `from()` function:

1. **Creation**: Factory functions create base components with explicit types
   ```typescript
   const counterModel = createModel<CounterModel>(({ set, get }) => ({
     count: 0,
     increment: () => set((state) => ({ count: state.count + 1 })),
   }));
   ```

2. **Composition**: The `from()` function enables fluent chaining for building derived components
   ```typescript
   // Actions from models
   const actions = from(model).createActions(({ model }) => ({ /* ... */ }));
   
   // Selectors from models  
   const selectors = from(model).createSelectors(({ model }) => ({ /* ... */ }));
   
   // Views from selectors with optional actions
   const view = from(selectors)
     .withActions(actions)
     .createView(({ selectors, actions }) => ({ /* ... */ }));
   ```

3. **Component Composition**: The `withComponent()` function for enhancing existing components

## Building Blocks

### Model – Primary Unit of Composition

Models encapsulate state and business logic, defining the contract for state and mutations. They are available for composition but not exposed to consumers.

```typescript
// Create a model with state and methods using explicit type annotation
const counterModel = createModel<CounterModel>(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
```

### Actions – Pure Intent Functions

Actions represent WHAT should happen, delegating to model methods (HOW). Actions are created using the fluent `from()` API. **Actions are pure intent functions** - they contain no logic themselves, only delegation to model methods.

```typescript
// Create actions that delegate to model methods using from() API
const actions = from(model).createActions(({ model }) => ({
  increment: model().increment,
  incrementTwice: model().incrementTwice,
}));
```

### Selectors – Derived Read API

Selectors provide read-only access to the model through direct properties and computed values. They form the public read API surface. Selectors are created using the fluent `from()` API.

```typescript
// Create selectors for the model using from() API
const selectors = from(model).createSelectors(({ model }) => ({
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
const modelA = createModel<{count: number, title: string}>(({ set, get }) => ({ 
  count: 0, 
  title: "Counter A"
}));

const selectorsA = from(modelA).createSelectors(({ model }) => ({
  count: model().count,
  title: model().title,
}));

// Model B has count: number, but no title property
const modelB = createModel<{count: number}>(({ set, get }) => ({ 
  count: 0 
  // No title property
}));
```

Similarly, TypeScript will catch type incompatibilities:

```typescript
// Model A has count as number
const modelA = createModel<{count: number}>(({ set, get }) => ({ count: 0 }));
const selectorsA = from(modelA).createSelectors(({ model }) => ({
  count: model().count, // number
}));

// Model B has count as string
const modelB = createModel<{count: string}>(({ set, get }) => ({ count: "zero" }));
```

This type safety helps prevent runtime errors and ensures that compositions are valid.

### View – Reactive UI Attributes

Views transform selectors into UI attributes and provide interaction logic. They **only** access selectors and actions, not the model directly. Views are created using the fluent `from()` API with chaining support.

```typescript
// Create a view with UI attributes and interaction handlers using from() API
const counterView = from(selectors)
  .withActions(actions)
  .createView(({ selectors, actions }) => ({
    "data-count": selectors().count,
    "aria-live": "polite",
    onClick: () => actions().increment(), // Actions are called, not referenced
  }));

// Complex interaction logic is also supported
const advancedView = from(selectors)
  .withActions(actions)
  .createView(({ selectors, actions }) => ({
    onClick: (event) => {
      // View logic combines multiple pure intents
      if (event.shiftKey) {
        actions().incrementTwice(); // Pure intent call
      } else {
        actions().increment(); // Pure intent call
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
  const model = createModel<CounterModel>(({ set, get }) => ({ 
    count: 0,
    increment: () => set(state => ({ count: state.count + 1 })),
    decrement: () => set(state => ({ count: state.count - 1 }))
  }));

  // Define actions that delegate to model methods using from() API
  const actions = from(model).createActions(({ model }) => ({
    increment: model().increment,
    decrement: model().decrement
  }));

  // Define selectors that expose model properties using from() API
  const selectors = from(model).createSelectors(({ model }) => ({
    count: model().count,
    isPositive: model().count > 0
  }));

  // Define views for UI using from() API with chaining
  const counterView = from(selectors).createView(({ selectors }) => ({
    "data-count": selectors().count,
    "aria-live": "polite"
  }));

  const buttonView = from(selectors)
    .withActions(actions)
    .createView(({ actions }) => ({
      onClick: () => actions().increment() // Actions are called, not referenced
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
    // Create enhanced model that adds reset functionality
    const enhancedModel = createModel<CounterModel & { reset(): void }>(
      (tools) => ({
        ...model()(tools),
        reset: () => tools.set({ count: 0 }),
      })
    );

    // Create enhanced actions using the from() API for better type inference
    const enhancedActions = from(enhancedModel).createActions(
      ({ model }) => ({
        ...actions()({ model }),
        reset: model().reset,
      })
    );

    const enhancedSelectors = from(enhancedModel).createSelectors(
      ({ model }) => ({
        ...selectors()({ model }),
        // Add new computed properties if needed
      })
    );

    const enhancedCounter = from(enhancedSelectors)
      .withActions(enhancedActions)
      .createView(({ actions, selectors }) => ({
        ...view.counter()({ actions, selectors }),
        onClick: () => actions().reset(), // Actions are called, not referenced
      }));

    // Return the enhanced component configuration
    return {
      model: enhancedModel,
      actions: enhancedActions,
      selectors: enhancedSelectors,
      view: { counter: enhancedCounter },
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