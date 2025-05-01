# Lattice – Draft Spec v0.6 (2025‑05‑03)

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

### Core Middleware: `withStoreSync`

```ts
// Middleware for syncing multiple Zustand stores
export function withStoreSync<
  S extends Record<string, StoreApi<any>>,
  T extends object,
>(
  stores: S,
  selector: (
    storesState: { [K in keyof S]: ReturnType<S[K]["getState"]> },
  ) => T,
) {
  return <U>(config: StateCreator<U>) => (set, get, api) => {
    // Subscribe to all stores
    const unsubscribers = Object.entries(stores).map(([storeKey, store]) =>
      store.subscribe(() => {
        // When any store updates, recompute and set the synced props
        const selected = selector(
          Object.fromEntries(
            Object.entries(stores).map(([k, s]) => [k, s.getState()]),
          ) as any,
        );
        set(selected);
      })
    );

    // Initialize synced props
    const initialSelected = selector(
      Object.fromEntries(
        Object.entries(stores).map(([k, s]) => [k, s.getState()]),
      ) as any,
    );

    return {
      ...initialSelected,
      ...config(set, get, api),
    };
  };
}
```

### Core Middleware: `withLattice`

```ts
// Middleware for merging with a base lattice
export function withLattice(baseLattice) {
  return (config) => {
    const { api = {}, hooks = {}, props = {}, ...rest } = config;

    return {
      api: {
        ...baseLattice.api,
        ...api,
      },
      hooks: {
        ...baseLattice.hooks,
        ...hooks,
      },
      props: Object.entries(props).reduce((acc, [key, value]) => {
        if (baseLattice.props[key]) {
          acc[key] = mergeProps([baseLattice.props[key], value]);
        } else {
          acc[key] = value;
        }
        return acc;
      }, { ...baseLattice.props }),
      use: baseLattice.use,
      ...rest,
    };
  };
}
```

### Core Utility: `createAPI`

```ts
// Create the API layer with hook system
export function createAPI<T extends object>(
  config: StateCreator<T>,
) {
  // Create API store - users can optionally wrap config with withStoreSync
  const apiStore = create(config);

  // Create hooks system
  const hooks = createHooks(apiStore.getState());

  // Add hooks to the store
  apiStore.setState({
    ...apiStore.getState(),
    _hooks: hooks,
  });

  // Return a clean API + hooks interface
  return {
    api: apiStore,
    hooks: {
      before: (method, callback) =>
        apiStore.getState()._hooks.before(method, callback),
      after: (method, callback) =>
        apiStore.getState()._hooks.after(method, callback),
    },
  };
}
```

### Core Utility: `createProps`

```ts
// Create a props factory that returns ready-to-spread UI attributes
export function createProps(
  partName: string,
  dependencies = {},
  config?: StateCreator<any>,
) {
  // Case 1: createProps(partName, config) - Simple case
  if (typeof dependencies === "function") {
    return create(dependencies);
  }

  // Case 2: Check if dependencies is already middleware (e.g., withStoreSync)
  if (typeof dependencies === "function" && typeof config === "function") {
    return create(dependencies(config));
  }

  // Case 3: dependencies is an object of store dependencies - apply withStoreSync
  if (Object.keys(dependencies).length > 0 && config) {
    return create(withStoreSync(dependencies, () => ({}))(config));
  }

  // Case 4: Just plain config
  return create(config || (() => ({})));
}
```

### Core Utility: `createLattice`

```ts
// Create a lattice with the given name and configuration
export function createLattice(name, config = {}) {
  // Default empty values
  const { api = {}, hooks = {}, props = {}, use = (fn) => fn(this) } = config;

  return {
    name,
    api,
    hooks,
    props,
    use,
  };
}
```

### Composing a **Selection** lattice

```ts
// Create a selection plugin directly
export const createSelectionPlugin = () => {
  // Returns a plugin function that adds selection to a base lattice
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

    // Props for selection
    const selectionTreeItemProps = createProps(
      "treeItem",
      { selectionAPI }, // Simply pass the dependency
      (set, get) => ({
        // Returns a factory function for props
        get: ({ id }) => ({
          // Reactively subscribes to the selection state
          "aria-selected": selectionAPI.getState().isSelected(id),
        }),
      }),
    );

    // Hook into the base lattice
    baseLattice.hooks.before("toggleNode", (id) => {
      selectStore.getState()._selectNode(id, false);
    });

    // Create an enhanced lattice with much less boilerplate
    return createLattice(
      "selection",
      withLattice(baseLattice)({
        api: selectionAPI,
        hooks: selectionHooks,
        props: {
          treeItem: selectionTreeItemProps,
        },
      }),
    );
  };
};
```

## 5 Drag and Drop Plugin Example

```ts
// Create a drag and drop plugin
export const createDragAndDropPlugin = () => {
  // Returns a plugin function that adds drag and drop to a base lattice
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
        { dragStore, baseLattice: baseLattice.api },
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

    // Create props for drag and drop
    const dragItemProps = createProps(
      "treeItem",
      withStoreSync(
        { dragAndDropAPI, baseLattice: baseLattice.api },
        () => ({
          // Sync nothing, just establish subscription
        }),
      )((set, get) => ({
        // Returns a factory function for props
        get: ({ id }) => ({
          draggable: true,
          "aria-grabbed": dragAndDropAPI.getState().isDragging(id),
          "data-draggable": hasSelection
            ? baseLattice.api.getState().isSelected?.(id)
            : true,
          onDragStart: () => dragAndDropAPI.getState().dragStart(id),
          onDrop: () => {/* ... */},
        }),
      })),
    );

    // Add after-drop hook
    dragAndDropHooks.after("drop", (result, targetId) => {
      // Additional logic after drop
    });

    // Create an enhanced lattice by merging with the base
    return createLattice("dragAndDrop", {
      // Merge APIs
      api: {
        ...baseLattice.api,
        ...dragAndDropAPI,
      },

      // Merge hooks
      hooks: {
        ...baseLattice.hooks,
        ...dragAndDropHooks,
      },

      // Merge props
      props: {
        ...baseLattice.props,
        treeItem: mergeProps([
          baseLattice.props.treeItem,
          dragItemProps,
        ]),
      },

      // Preserve plugin system
      use: baseLattice.use,
    });
  };
};
```

## 6 Consuming in an app

```ts
// Create independent instances (each with its own state)
const treeA = createArboreal();
const treeB = createArboreal();

// Create plugins
const selectionPlugin = createSelectionPlugin();
const dragAndDropPlugin = createDragAndDropPlugin();

// Apply plugins to first tree instance
const enhancedTreeA = treeA.use(selectionPlugin).use(dragAndDropPlugin);

// Apply only selection to second tree instance
const enhancedTreeB = treeB.use(selectionPlugin);

// Access API via useStore in React components
function TreeNodeA({ id }) {
  // All APIs are accessible directly from the enhanced lattice
  const isOpen = useStore(enhancedTreeA.api, (state) => state.isOpen(id));
  const isSelected = useStore(
    enhancedTreeA.api,
    (state) => state.isSelected(id),
  );
  const isDragging = useStore(
    enhancedTreeA.api,
    (state) => state.isDragging(id),
  );

  // Get mutation functions
  const toggleNode = useStore(enhancedTreeA.api, (state) => state.toggleNode);
  const selectNode = useStore(enhancedTreeA.api, (state) => state.selectNode);
  const dragStart = useStore(enhancedTreeA.api, (state) => state.dragStart);

  // Use props - call the get function with parameters
  const props = useStore(
    enhancedTreeA.props.treeItem,
    (propsStore) => propsStore.get({ id }),
  );

  // Return JSX...
}

// Each instance maintains its own state and hooks
enhancedTreeA.hooks.before("toggleNode", (id) => {
  console.log("About to toggle node in Tree A", id);
});

enhancedTreeB.hooks.before("toggleNode", (id) => {
  console.log("About to toggle node in Tree B", id);
});

// Updating TreeA doesn't affect TreeB
enhancedTreeA.api.getState().toggleNode("node-1"); // Only logs for Tree A
enhancedTreeB.api.getState().toggleNode("node-2"); // Only logs for Tree B
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

## 7 React Usage Example

```tsx
function TreeNode({ tree, id }: { tree: ArborealInstance; id: ID }) {
  // Each component can work with a specific tree instance
  const props = useStore(
    tree.props.treeItem,
    (propsStore) => propsStore.get({ id }),
  );

  // Subscribe to specific API values for this instance
  const isOpen = useStore(tree.api, (state) => state.isOpen(id));
  const isSelected = useStore(tree.api, (state) => state.isSelected?.(id));

  // Get mutation functions for this instance
  const toggleNode = useStore(tree.api, (state) => state.toggleNode);
  const selectNode = useStore(tree.api, (state) => state.selectNode);

  return (
    <li
      {...props}
      className={`
        ${isOpen ? "open" : "closed"} 
        ${isSelected ? "selected" : ""}
      `}
      onClick={() => {
        // Execute mutations on this specific instance
        toggleNode(id);
        selectNode?.(id, false);
      }}
    >
      {isOpen ? "📂" : "📁"} Node {id}
      {/* Children rendered here */}
    </li>
  );
}

// Multiple trees can exist on the same page
function App() {
  // Create two independent tree instances
  const projectTree = useMemo(
    () => createArboreal().use(createSelectionPlugin()),
    [],
  );
  const fileTree = useMemo(
    () => createArboreal().use(createSelectionPlugin()),
    [],
  );

  return (
    <div className="app">
      <div className="projects">
        <TreeNode tree={projectTree} id="project-1" />
        <TreeNode tree={projectTree} id="project-2" />
      </div>
      <div className="files">
        <TreeNode tree={fileTree} id="file-1" />
        <TreeNode tree={fileTree} id="file-2" />
      </div>
    </div>
  );
}
```

## 8 Props System: Reactive UI Attributes

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

### How Props Work

1. **Reactive Zustand Stores** - Each props object is a Zustand store that
   returns ready-to-spread UI attributes
2. **Component-Oriented** - Props are namespaced by UI part (e.g., `tree`,
   `treeItem`) for targeted application
3. **Composition via Merge** - When plugins are added, their props are
   automatically merged with the base props

### Consuming Props

```tsx
// Creating props for a component part
const buttonProps = createProps(
  "button", // UI part name
  { someAPI }, // Pass dependencies directly
  (set, get) => ({
    // Returns a factory function for props
    get: ({ id }) => ({
      role: "button",
      "aria-pressed": someAPI.getState().isPressed(id),
      tabIndex: 0,
      onClick: () => someAPI.getState().toggle(id),
    }),
  }),
);

// Or using explicit middleware
const buttonProps = createProps(
  "button",
  withStoreSync(
    { someAPI },
    ({ someAPI }) => ({
      pressed: someAPI.pressed,
    }),
  ),
  (set, get) => ({
    get: ({ id }) => ({
      role: "button",
      "aria-pressed": get().pressed,
      tabIndex: 0,
      onClick: () => someAPI.getState().toggle(id),
    }),
  }),
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
3. **Composition Without Conflicts** - Props from multiple plugins merge
   correctly without overrides
4. **Framework Agnostic** - Core props system works with any UI framework that
   supports attribute spreading
5. **Optional Store Sync** - The `withStoreSync` middleware can be used when
   needed
6. **Flexible Architecture** - Follows Zustand patterns for middleware
   composition

### Implementation Details

This pattern ensures that:

1. Each UI part has its own reactive props store
2. Props are computed only when needed
3. Components subscribe only to the props they use
4. State changes trigger minimal re-renders
5. When plugins are added, their props are correctly merged with the base props
6. Conflicts are resolved deterministically (plugin props take precedence)
7. Store dependencies are managed explicitly with the withStoreSync middleware

The result is a system where:

- Plugins can extend or override props for specific UI parts
- Components receive a single props object with all necessary attributes
- Updates to any underlying state trigger precise re-renders
- Developers have full control over store dependencies and synchronization

---

## 9 Rationale — Why Lattice, not "just hooks"

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
- **Plugin composition**: Behaviours cooperate via hooks—no fragile ref hacks.
- **Zustand foundation**: familiar DX, dev‑tools time‑travel, no custom state
  engine.
- **Instance-based architecture**: Multiple independent instances can coexist
  with proper state isolation.

> TL;DR — Hooks remain perfect for simple widgets, but once you need **WCAG‑AA,
> pluginability, portability, and proper state isolation**, Lattice provides the
> missing middle layer.

---

## 10 Open Questions

- Hot‑reload boundary: HMR should reuse slices—explore `

```ts
// 1️⃣  Create a tree lattice instance directly
export const createArboreal = (options = {}) => {
  // Create private slices (scoped to this instance)
  const treeStore = create((set, get) => ({
    nodes: {} as Record<ID, Node>,
    open: new Set<ID>(),

    // Internal state mutation
    _toggleNode: (id: ID) => {
      set((state) => {
        const nextOpen = new Set(state.open);
        state.open.has(id) ? nextOpen.delete(id) : nextOpen.add(id);
        return { ...state, open: nextOpen };
      });
    },
  }));

  // 2️⃣  Create API for this instance with store sync
  const { api: treeAPI, hooks: treeHooks } = createAPI(
    withStoreSync(
      { treeStore },
      ({ treeStore }) => ({
        // Sync properties from treeStore that we need
        nodes: treeStore.nodes,
        open: treeStore.open,
      }),
    )((set, get) => ({
      // Getters (read functions)
      isOpen: (id) => get().open.has(id),
      children: (id) =>
        Object.values(get().nodes).filter((n) => n.parent === id),

      // Mutations (write functions)
      toggleNode: (id: ID) => {
        // Access the store directly
        treeStore.getState()._toggleNode(id);
      },
    })),
  );

  // 3️⃣  Create Props for this instance
  const treeProps = createProps(
    "tree",
    (set, get) => ({
      // Returns a factory function for DOM/ARIA properties
      get: () => ({
        role: "tree",
        tabIndex: 0,
      }),
    }),
  );

  const treeItemProps = createProps(
    "treeItem",
    { treeAPI }, // Simplified dependency syntax
    (set, get) => ({
      // Returns a factory function for DOM/ARIA properties
      get: ({ id }) => ({
        role: "treeitem",
        "aria-expanded": treeAPI.getState().isOpen(id),
      }),
    }),
  );

  // 4️⃣  Package as lattice
  return createLattice("arboreal", {
    api: treeAPI,
    hooks: treeHooks,
    props: { tree: treeProps, treeItem: treeItemProps },

    // Add a simple plugin system
    use: function (plugin) {
      return plugin(this);
    },
  });
};
```
