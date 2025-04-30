# Lattice – Draft Spec v0.6 (2025‑05‑03)

A **headless, WCAG‑AA‑ready component framework** built on Zustand. The goal is
React‑first DX with framework‑agnostic core.

---

## 1 Glossary (revised)

| Term        | Meaning                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- |
| **Slice**   | Private Zustand store created with `create`.                                                 |
| **API**     | Unified public interface with getters (selectors) and setters (mutations).                   |
| **Props**   | Reactive Zustand store that returns ready-to-spread UI attributes including ARIA properties. |
| **Hooks**   | System to intercept mutations for cross-cutting concerns (`before`/`after`).                 |
| **Lattice** | Bundle of APIs, props with namespaces. Lattices can compose other lattices.                  |

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

  // 2️⃣  Create API for this instance
  const { api: treeAPI, hooks: treeHooks } = createAPI((set, get) => ({
    // Getters (read functions)
    isOpen: (id) => treeStore.getState().open.has(id),
    children: (id) =>
      Object.values(treeStore.getState().nodes).filter((n) => n.parent === id),

    // Mutations (write functions)
    toggleNode: (id: ID) => {
      treeStore.getState()._toggleNode(id);
    },
  }));

  // 3️⃣  Create Props for this instance
  const treeProps = createProps("tree", {}, () => ({
    // Returns a Zustand store with DOM/ARIA properties
    role: "tree",
    tabIndex: 0,
  }));

  const treeItemProps = createProps("treeItem", { treeAPI }, (get, { id }) => ({
    // Returns a Zustand store with DOM/ARIA properties
    role: "treeitem",
    "aria-expanded": get().isOpen(id), // Get from the merged API store
  }));

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

// Helper to create a unified API with hooks
function createAPI(dependencies, factory) {
  // Get the raw API object from the factory
  const rawApi = factory(dependencies);

  // Create a reactive Zustand store for actual state only
  // (Not storing functions in state)
  const apiStore = create(() => {
    // Extract non-function properties for state
    const stateProps = {};
    for (const key of Object.keys(rawApi)) {
      if (typeof rawApi[key] !== "function") {
        stateProps[key] = rawApi[key];
      }
    }
    return stateProps;
  });

  // Set up hooks system
  const hookSystem = {
    before: {},
    after: {},
  };

  // Attach functions directly to the store object (not in state)
  for (const key of Object.keys(rawApi)) {
    if (typeof rawApi[key] === "function") {
      const originalFn = rawApi[key];

      // Create hook arrays for this function
      hookSystem.before[key] = [];
      hookSystem.after[key] = [];

      // Attach enhanced function directly to store object
      apiStore[key] = (...args) => {
        // Run before hooks
        for (const hook of hookSystem.before[key]) {
          const result = hook(...args);
          if (result === false) return; // Cancel if a hook returns false
        }

        // Run the original function
        const result = originalFn(...args);

        // Run after hooks
        for (const hook of hookSystem.after[key]) {
          hook(result, ...args);
        }

        return result;
      };
    }
  }

  // Auto-generate hook-friendly selectors for React
  apiStore.use = {};
  for (const key of Object.keys(rawApi)) {
    if (typeof rawApi[key] === "function") {
      // For functions, just return the function from the store object
      apiStore.use[key] = () => apiStore[key];
    } else {
      // For state values, create a selector
      apiStore.use[key] = (params) =>
        useStore(
          apiStore,
          (state) => state[key],
        );
    }
  }

  // Return both the API store and a separate hooks manager
  return {
    api: apiStore,
    hooks: {
      before: (fnName, hook) => {
        if (hookSystem.before[fnName]) {
          hookSystem.before[fnName].push(hook);
        }
        return apiStore; // For chaining
      },
      after: (fnName, hook) => {
        if (hookSystem.after[fnName]) {
          hookSystem.after[fnName].push(hook);
        }
        return apiStore; // For chaining
      },
    },
  };
}

// Helper to create props with a merged get access
function createProps(namespace, dependencies, factory) {
  // Create a merged get function that provides access to all dependencies
  const createGet = () => {
    const mergedStore = {};

    // Merge all API stores into a single accessor
    for (const [key, store] of Object.entries(dependencies)) {
      if (store && typeof store.getState === "function") {
        Object.assign(mergedStore, store.getState());
      }
    }

    return () => mergedStore;
  };

  // Create the props store with the factory
  return create((set) => {
    // Return a function that produces props when called with params
    return (params) => factory(createGet(), params);
  });
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
    const { api: selectionAPI, hooks: selectionHooks } = createAPI((
      set,
      get,
    ) => ({
      // Getters
      isSelected: (id) => selectStore.getState().selected.has(id),

      // Mutations
      selectNode: (id: ID, multi = false) => {
        selectStore.getState()._selectNode(id, multi);
      },
    }));

    // Props for selection
    const selectionTreeItemProps = createProps(
      "treeItem",
      { selectionAPI },
      (get, { id }) => ({
        // Reactively subscribes to the selection state
        "aria-selected": get().isSelected(id),
      }),
    );

    // Hook into the base lattice
    baseLattice.hooks.before("toggleNode", (id) => {
      selectStore.getState()._selectNode(id, false);
    });

    // Create an enhanced lattice by merging with the base
    return createLattice("selection", {
      // Merge APIs
      api: {
        ...baseLattice.api,
        ...selectionAPI,
      },

      // Merge hooks
      hooks: {
        ...baseLattice.hooks,
        ...selectionHooks,
      },

      // Merge props
      props: {
        ...baseLattice.props,
        treeItem: mergeProps([
          baseLattice.props.treeItem,
          selectionTreeItemProps,
        ]),
      },

      // Preserve plugin system
      use: baseLattice.use,
    });
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
    const hasSelection = typeof baseLattice.api.isSelected === "function";

    // Create API for drag and drop
    const { api: dragAndDropAPI, hooks: dragAndDropHooks } = createAPI((
      set,
      get,
    ) => ({
      // Getters
      isDragging: (id) => dragStore.getState().draggingId === id,
      canDrop: (id) => {/* ... */},

      // Mutations
      dragStart: (id) => {
        dragStore.getState()._setDragging(id);
      },

      drop: (targetId) => {
        const draggingId = dragStore.getState().draggingId;
        if (draggingId && targetId) {
          // Implement drop logic
          dragStore.getState()._clearDragging();
          return { success: true, from: draggingId, to: targetId };
        }
        return { success: false };
      },
    }));

    // Create props for drag and drop
    const dragItemProps = createProps(
      "treeItem",
      { dragAndDropAPI, baseLattice },
      (get, { id }) => ({
        draggable: true,
        "aria-grabbed": get().isDragging(id),
        "data-draggable": hasSelection ? get().isSelected?.(id) : true,
        onDragStart: () => get().dragStart(id),
        onDrop: () => {/* ... */},
      }),
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

// Access API via hooks in React components
function TreeNodeA({ id }) {
  // All APIs are accessible directly from the enhanced lattice
  const isOpen = enhancedTreeA.api.use.isOpen(id);
  const isSelected = enhancedTreeA.api.use.isSelected(id);
  const isDragging = enhancedTreeA.api.use.isDragging(id);

  // Get mutation functions
  const toggleNode = enhancedTreeA.api.use.toggleNode();
  const selectNode = enhancedTreeA.api.use.selectNode();
  const dragStart = enhancedTreeA.api.use.dragStart();

  // Use props
  const props = useStore(
    enhancedTreeA.props.treeItem,
    (props) => props({ id }),
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
enhancedTreeA.api.toggleNode("node-1"); // Only logs for Tree A
enhancedTreeB.api.toggleNode("node-2"); // Only logs for Tree B
```

The system ensures each lattice instance has:

- Its own private state stores
- Isolated API instances
- Scoped hook registrations
- Properly composed dependencies

This approach scales to multiple independent instances on the same page while
maintaining proper state isolation and enabling cross-cutting concerns specific
to each instance.

## 7 React Usage Example

```tsx
function TreeNode({ tree, id }: { tree: ArborealInstance; id: ID }) {
  // Each component can work with a specific tree instance
  const props = useStore(tree.props.treeItem, (props) => props({ id }));

  // Subscribe to specific API values for this instance
  const isOpen = tree.api.use.isOpen(id);
  const isSelected = tree.api.use.isSelected(id);

  // Get mutation functions for this instance
  const toggleNode = tree.api.use.toggleNode();
  const selectNode = tree.api.use.selectNode();

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
        selectNode(id, false);
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
┌─────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│                 │     │                   │     │                    │
│  Private Slices │────▶│  API (getters &   │────▶│  Props (reactive   │
│  (state stores) │     │    mutations)     │     │   UI attributes)   │
│                 │     │                   │     │                    │
└─────────────────┘     └───────────────────┘     └─────────┬──────────┘
                                                            │
                                                            │
                                                            ▼
                                               ┌──────────────────────────┐
                                               │                          │
                                               │ React/Vue/etc Components │
                                               │ (spread props on els)    │
                                               │                          │
                                               └──────────────────────────┘
```

### How Props Work

1. **Reactive Zustand Stores** - Each props object is a Zustand store that
   returns ready-to-spread UI attributes
2. **Automatic ARIA Inclusion** - Props include semantic and accessibility
   attributes derived from component state
3. **Component-Oriented** - Props are namespaced by UI part (e.g., `tree`,
   `treeItem`) for targeted application
4. **Composition via Merge** - When plugins are added, their props are
   automatically merged with the base props

### Consuming Props

```tsx
// Creating props for a component part
const buttonProps = createProps(
  "button", // UI part name
  { someAPI }, // Dependencies
  (get, { id }) => ({
    // Returns a function that produces props when called with parameters
    role: "button",
    "aria-pressed": get(someAPI).isPressed(id),
    tabIndex: 0,
    onClick: () => get(someAPI).toggle(id),
  }),
);

// In a React component:
function Button({ lattice, id }) {
  // 1. Call useStore to subscribe to the props store
  // 2. The selector calls the props function with the given parameters
  // 3. Returns a ready-to-spread object with all DOM/ARIA attributes
  const props = useStore(
    lattice.props.button,
    (propsFactory) => propsFactory({ id }),
  );

  // Simply spread the props onto your element
  return <button {...props}>Click Me</button>;
}
```

### Advantages over Manual Prop Construction

1. **Reactive to State Changes** - Props automatically update when underlying
   state changes
2. **Granular Re-renders** - Component only re-renders when the specific props
   it needs change
3. **Accessibility Built-in** - ARIA attributes are automatically included and
   kept in sync with state
4. **Composition Without Conflicts** - Props from multiple plugins merge
   correctly without overrides
5. **Framework Agnostic** - Core props system works with any UI framework that
   supports attribute spreading

### Implementation Details

```tsx
function createProps(partName, dependencies, factory) {
  // Create a Zustand store that returns a function
  return create((set, get) => {
    // Return a function that takes parameters and returns props
    return (params) => {
      // Call the factory with the getter and parameters
      const propsObject = factory(get, params);

      // Return the props object to be spread
      return propsObject;
    };
  });
}

// When composing lattices, props with the same name get merged
function createLattice(namespace, dependencies, factory) {
  const { api, props = {}, init } = factory(dependencies);

  // Store for the composed lattice
  const result = {
    api,
    props,
    // Method to compose with other lattices
    use: (plugin) => {
      // Get the plugin factory with this lattice as a dependency
      const pluginInstance = plugin({ [namespace]: result, ...dependencies });

      // Merge APIs - implementation detail omitted for brevity

      // Merge props by UI part name
      for (
        const [partName, propStore] of Object.entries(
          pluginInstance.props || {},
        )
      ) {
        if (!result.props[partName]) {
          // If the part doesn't exist in the result, just add it
          result.props[partName] = propStore;
        } else {
          // If the part exists, create a composed store that merges props
          const baseProps = result.props[partName];
          result.props[partName] = create((set, get) => {
            return (params) => {
              // Get both prop objects
              const basePropsObj = baseProps.getState()(params);
              const pluginPropsObj = propStore.getState()(params);

              // Return merged props - plugin props take precedence for conflicts
              return { ...basePropsObj, ...pluginPropsObj };
            };
          });
        }
      }

      // Initialize the plugin
      if (pluginInstance.init) {
        pluginInstance.init();
      }

      return result;
    },
  };

  // Initialize the lattice
  if (init) {
    init();
  }

  return result;
}
```

This pattern ensures that:

1. Each UI part has its own reactive props store
2. Props are computed only when needed
3. Components subscribe only to the props they use
4. State changes trigger minimal re-renders
5. When plugins are added, their props are correctly merged with the base props
6. Conflicts are resolved deterministically (plugin props take precedence)

The result is a system where:

- Plugins can extend or override props for specific UI parts
- Components receive a single props object with all necessary attributes
- Accessibility props like ARIA attributes are automatically included
- Updates to any underlying state trigger precise re-renders

## 9 Accessibility Strategy

1. **Props carry semantics** → host adapters just spread them on elements.
2. **Shared keyboard map** plugin enforces WCAG navigation patterns.
3. **Playwright + axe** contract tests run for each lattice combo.

---

## 10 Rationale — Why Lattice, not "just hooks"

| When plain hooks shine                         | Where they crack                                                                                       | How Lattice closes the gap                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Small, single‑purpose widget (e.g. accordion). | Complex components like **Tree View** that mix selection, drag‑and‑drop, type‑ahead, virtualisation.   | Composable lattices encapsulate each behaviour through layered Zustand stores; props merge safely.    |
| One framework, one team.                       | **Cross‑framework** design‑system (React + Vue + Native).                                              | Core is JSX‑free; stores are framework-agnostic; adapters are thin wrappers.                          |
| WCAG handled by Radix/Headless UI façade.      | Custom ARIA choreography across multiple behaviours (aria‑grabbed + aria‑selected + roving tab index). | Props are reactive Zustand stores, merged per UI part; shared keyboard plugin enforces WCAG patterns. |
| Logic local to component.                      | Several products need to hot‑swap features (e.g. no DnD on mobile).                                    | Feature lattices can be added/removed at instantiation, with granular reactivity throughout stores.   |

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

## 11 Open Questions

- Hot‑reload boundary: HMR should reuse slices—explore `
