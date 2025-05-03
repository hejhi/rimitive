# Lattice

A **headless, WCAG‑AA‑ready component framework** built on Zustand. The goal is
React‑first DX with framework‑agnostic core.

---

## 1 Glossary (revised)

| Term        | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| **Slice**   | Private Zustand store created with `create`.                                 |
| **API**     | Unified public interface with getters (selectors) and setters (mutations).   |
| **Props**   | Reactive Zustand store that returns ready-to-spread UI attributes.           |
| **Hooks**   | System to intercept mutations for cross-cutting concerns (`before`/`after`). |
| **Lattice** | Bundle of APIs, props with namespaces. Lattices can compose other lattices.  |

---

## 2 Mental Model & Flow

```
                   ┌────────────── Reactive Zustand Stores ──────────────┐
                   ▼                      ▼                      ▼
Mutation + Hooks ──▶ Slice mutation ──▶ API & Props update ──▶ UI re‑render
```

- One‑way data‑flow. Mutations update slices. API and Props are reactive Zustand
  stores.
- Reactive composition: Private slices → API & Props → UI elements
- Each layer is a Zustand store, enabling precise subscriptions and memoization
- Hooks provide interception points for cross-cutting concerns

---

## 3 Factory Helpers (Zustand‑style)

### Composing a **Selection** lattice

```ts
// Create a selection lattice composing in the base tree lattice (through baseTreeLattice.use)
export const selectionLattice = () => {
  // Returns a lattice function that adds selection to a base lattice
  return (baseLattice) => {
    // Create private slice (scoped to this instance)
    const selectStore = create((set) => ({
      selected: new Set<ID>(),

      // Internal state mutation
      _selectNode: (id: ID, multi: boolean) => {
        set((state) => {
          const nextSelected = multi ? new Set(state.selected) : new Set();
          nextSelected.add(id);
          return { ...state, selected: nextSelected };
        });
      },
    }));

    // API for selection
    const { api: selectionAPI, hooks: selectionHooks } = createAPI(
      withStoreSync(
        { selectStore },
        ({ selectStore }) => ({
          // Sync the selected set from the selection store
          selected: selectStore.selected,
        }),
      )((set, get) => ({
        // Getters
        isSelected: (id) => get().selected.has(id),

        // Mutations
        selectNode: (id: ID, multi = false) => {
          // Direct access to the store
          selectStore.getState()._selectNode(id, multi);
        },
      })),
    );

    // Props for selection using withProps middleware
    const selectionTreeItemProps = createProps(
      "treeItem",
      // always compose back the base lattice unless you want to
      // completely override its props, but you don't need to use the third arg
      // unless you're overriding one
      withProps(baseLattice)(
        (get, set) => ({
          get: (params) => ({
            "aria-selected": selectionAPI.isSelected(params.id),
            onClick: (e) => {
              selectionAPI.selectNode(params.id, e.shiftKey);
            },
          }),
        }),
      ),
    );

    // Hook into the base lattice
    baseLattice.hooks.before("toggleNode", (id) => {
      selectStore.getState()._selectNode(id, false);
    });

    // Create lattice with using mergeProps
    return createLattice(
      "selection",
      withLattice(baseLattice)({
        api: selectionAPI,
        hooks: selectionHooks,
        props: mergeProps(selectionTreeItemProps),
      }),
    );
  };
};
```

## 4 Drag and Drop Lattice Example

```ts
// Create a drag and drop lattice
export const createDragAndDropLattice = () => {
  // Returns a lattice function that adds drag and drop to a base lattice
  return (baseLattice) => {
    // Create private slice for this instance
    const dragStore = create((set) => ({
      draggingId: null,
      dropTargets: new Set<ID>(),

      _setDragging: (id: ID) => {
        set({ draggingId: id });
      },

      _clearDragging: () => {
        set({ draggingId: null });
      },
    }));

    // Get the selection API if it exists in the base lattice
    const hasSelection =
      typeof baseLattice.api.getState().isSelected === "function";

    // Create API for drag and drop
    const { api: dragAndDropAPI, hooks: dragAndDropHooks } = createAPI(
      withStoreSync(
        { dragStore },
        ({ dragStore }) => ({
          // Sync dragging state from drag store
          draggingId: dragStore.draggingId,
          dropTargets: dragStore.dropTargets,
        }),
      )((set, get) => ({
        // Getters
        isDragging: (id) => get().draggingId === id,
        canDrop: (id) => {/* ... */},

        // Mutations
        dragStart: (id) => {
          dragStore.getState()._setDragging(id);
        },

        drop: (targetId) => {
          const draggingId = get().draggingId;
          if (draggingId && targetId) {
            // Implement drop logic
            dragStore.getState()._clearDragging();
            return { success: true, from: draggingId, to: targetId };
          }
          return { success: false };
        },
      })),
    );

    // Create props for drag and drop with withProps middleware
    const dragItemProps = createProps(
      "treeItem",
      withProps(baseLattice)(
        (get, set, treeItemProps) => ({
          get: (params) => ({
            draggable: true,
            "aria-grabbed": dragAndDropAPI.isDragging(params.id),
            "data-draggable": hasSelection
              ? treeItemProps.get(params).isSelected?.()
              : true,
            onDragStart: () => dragAndDropAPI.dragStart(params.id),
            onDrop: () => {/* ... */},
          }),
        }),
      ),
    );

    // Add after-drop hook
    dragAndDropHooks.after("drop", (result, targetId) => {
      // Additional logic after drop
    });

    // Create lattice using mergeProps
    return createLattice(
      "dragAndDrop",
      withLattice(baseLattice)({
        api: dragAndDropAPI,
        hooks: dragAndDropHooks,
        props: mergeProps(dragItemProps),
      }),
    );
  };
};
```

## 5 Consuming in an app

```ts
// Create lattices
const selectionLattice = createSelectionLattice();
const dragAndDropLattice = createDragAndDropLattice();

// Apply lattices to first tree instance
const treeA = createArboreal().use(selectionLattice).use(dragAndDropLattice);

// Apply only selection to second tree instance
const treeB = createArboreal().use(selectionLattice);

// Access API via useStore in React components
function TreeNodeA({ id }) {
  // All APIs are accessible directly from the lattice
  const isOpen = useStore(treeA.api, (state) => state.isOpen(id));
  const isSelected = useStore(
    treeA.api,
    (state) => state.isSelected(id),
  );
  const isDragging = useStore(
    treeA.api,
    (state) => state.isDragging(id),
  );

  // Get mutation functions
  const toggleNode = useStore(treeA.api, (state) => state.toggleNode);
  const selectNode = useStore(treeA.api, (state) => state.selectNode);
  const dragStart = useStore(treeA.api, (state) => state.dragStart);

  // Use props - call the get function with parameters
  const props = useStore(
    treeA.props.treeItem,
    (propsStore) => propsStore.get({ id }),
  );

  // Return JSX...
}

// Each instance maintains its own state and hooks
treeA.hooks.before("toggleNode", (id) => {
  console.log("About to toggle node in Tree A", id);
});

treeB.hooks.before("toggleNode", (id) => {
  console.log("About to toggle node in Tree B", id);
});

// Updating TreeA doesn't affect TreeB
treeA.api.getState().toggleNode("node-1"); // Only logs for Tree A
treeB.api.getState().toggleNode("node-2"); // Only logs for Tree B
```

The system ensures each lattice instance has:

- Its own private state stores
- Isolated API instances
- Scoped hook registrations
- Properly composed dependencies
- Optional store synchronization through the `withStoreSync` middleware

This approach scales to multiple independent instances on the same page while
maintaining proper state isolation and enabling cross-cutting concerns specific
to each instance.

## 6 Props System: Reactive UI Attributes

The Props system in Lattice is a key innovation that bridges state management
and UI rendering in a reactive, composable way.

```
┌────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│                │     │                   │     │                    │
│ Private Slices │────▶│  API (getters &   │────▶│  Props (reactive   │
│ (state stores) │     │    mutations)     │     │   UI attributes)   │
│                │     │                   │     │                    │
└────────────────┘     └───────────────────┘     └─────────┬──────────┘   
                                                           │              
                                                           │              
                                                           ▼              
                                              ┌──────────────────────────┐
                                              │                          │
                                              │ React/Vue/etc Components │
                                              │  (spread props on els)   │
                                              │                          │
                                              └──────────────────────────┘
```

### Core Concepts

1. **Reactive Store**: Each props object is a reactive store that returns
   ready-to-spread UI attributes
2. **UI Part Namespacing**: Props are organized by UI part (e.g., `tree`,
   `treeItem`) for targeted application
3. **Metadata-Driven**: Each props store carries its UI part name as metadata,
   enabling automatic organization
4. **Composition Model**: When lattices are composed, props can be:
   - Extended with new attributes
   - Overridden completely
   - Merged on a per-namespace basis

### How Props Work

1. **Reactive Zustand Stores** - Each props object is a Zustand store that
   returns ready-to-spread UI attributes
2. **Component-Oriented** - Props are namespaced by UI part (e.g., `tree`,
   `treeItem`) for targeted application
3. **Prop Composition** - When lattices are composed, each namespaced prop can
   be composed or overridden on a namespace-by-namespace basis. This enables:
   - Extending with new attributes
   - Complete overrides when needed
   - Granular merging per namespace
4. **Auto-Registration with partName** - Each props store carries its partName
   as metadata, allowing automatic organization when using mergeProps

### Consuming Props

```tsx
// 1. Basic props creation - simple case with direct config
const buttonProps = createProps(
  "button", // UI part name
  (set, get) => ({
    // Returns a factory function for props
    get: (params) => ({
      role: "button",
      "aria-label": params.label
      tabIndex: 0,
      // safe to access other apis directly without syncing as we're
      // inside a getter, so no need for `withStoreSync`
      "aria-selected": selectionAPI.isSelected(params.id),
    }),
  }),
);

// 2. Using withProps to compose props from another lattice
const treeItemProps = createProps(
  "treeItem",
  // composing a lattice returns the namespaced lattice props as the third
  // argument of the callback
  withProps(someLattice)((set, get, treeItemProps) => ({
    get: (params) => ({
      role: "button",
      "aria-label": params.label
      tabIndex: 0,
      "aria-selected": selectionAPI.isSelected(params.id),
      onClick: () => {
        // do something here as we override treeItemProps.onClick
        treeItemProps.get(params).onClick();
      }
    })
  }))
);

// In a React component:
function Button({ lattice, id }) {
  // 1. Call useStore to subscribe to the props store
  // 2. The selector calls the props factory function with the given parameters
  // 3. Returns a ready-to-spread object with all DOM/ARIA attributes
  const props = useStore(
    lattice.props.button,
    (propsStore) => propsStore.get({ id }),
  );

  // Simply spread the props onto your element
  return <button {...props}>Click Me</button>;
}
```

### Advantages of this approach

1. **Reactive to State Changes** - Props automatically update when underlying
   state changes
2. **Granular Re-renders** - Component only re-renders when the specific props
   it needs change
3. **Composition Without Conflicts** - Props from multiple lattices can be
   composed together
4. **Framework Agnostic** - Core props system works with any UI framework that
   supports attribute spreading
5. **Reduced Redundancy** - No need to specify partName twice; mergeProps uses
   store metadata
6. **Flexible Architecture** - Follows Zustand patterns for middleware
   composition
7. **Explicit Event Handler Composition** - Event handlers are composed in a
   predictable sequence

### Implementation Details

This pattern ensures that:

1. Each UI part has its own reactive props store with partName metadata
2. Props are computed only when needed
3. Components subscribe only to the props they use
4. State changes trigger minimal re-renders
5. When lattices are composed, namespaced props are merged
6. Conflicts are resolved deterministically with explicit handler composition
7. Store dependencies are managed explicitly with middleware

The result is a system where:

- Lattices can extend or override props for specific UI parts
- Components receive a single props object with all necessary attributes
- Updates to any underlying state trigger precise re-renders
- Developers have full control over store dependencies and synchronization
- Code is less redundant by leveraging store metadata

## 7 Direct API Access Pattern

A core principle of Lattice is to provide ergonomic, direct access to API
methods without requiring verbose chaining patterns. The examples in the spec
demonstrate this pattern, but it's important to explicitly document it.

### The Pattern

API methods should be accessible directly from the API object, without requiring
`.getState()`:

```ts
// ✅ Direct API access (preferred)
selectionAPI.selectNode(id, multi);
selectionAPI.isSelected(id);

// ❌ Verbose chaining (avoid)
selectionAPI.getState().selectNode(id, multi);
selectionAPI.getState().isSelected(id);
```

This pattern is consistently used throughout the examples in sections 3-5, but
requires explicit implementation in the `createAPI` function.

### Implementation Details

The direct API access pattern is implemented in `createAPI` by returning a
composed store that proxies method calls directly to the state:

```ts
export function createAPI<T>(stateCreator) {
  const store = create(stateCreator);

  // Create hooks system for interception
  const hooks = createHooksSystem();

  // Add hooks system to the store state
  store.setState((state) => ({
    ...state,
    _hooks: hooks,
  }));

  // Proxy for direct method access
  const enhancedStore = new Proxy(store, {
    get(target, prop) {
      // Original store properties take precedence
      if (prop in target) {
        return target[prop];
      }

      // For methods that exist in the state, provide direct access
      const state = target.getState();
      if (typeof state[prop] === "function") {
        return (...args) => {
          // Execute before hooks
          hooks.executeBefore(prop, ...args);

          // Call the actual method
          const result = state[prop](...args);

          // Execute after hooks and return the result
          return hooks.executeAfter(prop, result, ...args);
        };
      }

      // For other properties, provide direct access to state
      if (prop in state && prop !== "_hooks") {
        return state[prop];
      }

      return target[prop];
    },
  });

  return { api: enhancedStore, hooks };
}
```

### Usage in Lattice Composition

When creating a lattice, the direct API access should be preserved through
composition:

```ts
// Create the enhanced lattice
return createLattice(
  "selection",
  withLattice(baseLattice)({
    api: selectionAPI, // This API must support direct method access
    hooks: selectionHooks,
    props: {
      treeItem: selectionTreeItemProps,
    },
  }),
);
```

### Benefits

This pattern provides significant ergonomic improvements:

1. **Reduced Verbosity** - Methods are called directly without chaining through
   `.getState()`
2. **Cleaner Codebase** - Less boilerplate and more readable code
3. **Consistent Mental Model** - API is treated as a stateful object with
   methods
4. **Improved DX** - Better developer experience when interacting with the API

Direct API access is particularly valuable in frequently accessed methods and
when composing complex behaviors. It also makes testing and debugging easier
with a more straightforward calling pattern.

---

## 8 Rationale — Why Lattice, not "just hooks"

| When plain hooks shine                         | Where they crack                                                                                       | How Lattice closes the gap                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Small, single‑purpose widget (e.g. accordion). | Complex components like **Tree View** that mix selection, drag‑and‑drop, type‑ahead, virtualisation.   | Composable lattices encapsulate each behaviour through layered Zustand stores; props merge safely.  |
| One framework, one team.                       | **Cross‑framework** design‑system (React + Vue + Native).                                              | Core is JSX‑free; stores are framework-agnostic; adapters are thin wrappers.                        |
| WCAG handled by Radix/Headless UI façade.      | Custom ARIA choreography across multiple behaviours (aria‑grabbed + aria‑selected + roving tab index). | Props are reactive Zustand stores, merged per UI part                                               |
| Logic local to component.                      | Several products need to hot‑swap features (e.g. no DnD on mobile).                                    | Feature lattices can be added/removed at instantiation, with granular reactivity throughout stores. |

### Unique value propositions

- **Unified API**: Getters and mutations in a single API object with
  auto-generated hooks.
- **Hooks system**: Clean interception points for cross-cutting concerns
  directly on API functions.
- **Layered Zustand stores**: Slices → API → Props, with precise, granular
  reactivity.
- **Lattice composition**: Behaviours cooperate via hooks—no fragile ref hacks.
- **Zustand foundation**: familiar DX, dev‑tools time‑travel, no custom state
  engine.
- **Instance-based architecture**: Multiple independent instances can coexist
  with proper state isolation.

> TL;DR — Hooks remain perfect for simple widgets, but once you need **WCAG‑AA,
> composability, portability, and proper state isolation**, Lattice provides the
> missing middle layer.
