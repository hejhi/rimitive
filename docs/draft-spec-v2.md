# Lattice – Draft Spec v0.4 (2025‑05‑01)

A **headless, WCAG‑AA‑ready component framework** built on Zustand. The goal is
React‑first DX with framework‑agnostic core.

---

## 1 Glossary (revised)

| Term                | Meaning                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Private Slice**   | Internal Zustand store created with `createStore` that encapsulates implementation.    |
| **Public Slice**    | Zustand store that exposes public API derived from one or more private slices.         |
| **Selector**        | Auto-generated accessor functions for reactive state derived from slices.              |
| **Props Generator** | Function that returns ready-to-spread UI attributes including ARIA properties.         |
| **Command**         | Public function that mutates state with middleware support for cross-cutting concerns. |
| **Middleware**      | Function that intercepts commands or wraps stores for cross-cutting concerns.          |
| **Lattice**         | Composition of public slices with auto-generated selectors and middleware support.     |

---

## 2 Mental Model & Flow

```
                   ┌────────────── Reactive Zustand Stores ──────────────┐
                   ▼                      ▼                      ▼
Command + Middleware ──▶ Private Slice mutation ──▶ Public Slice updates ──▶ UI re‑render
```

- One‑way data‑flow. Commands update private slices. Public slices are derived
  stores.
- Reactive composition: Private slices → Public slices → Auto-generated
  selectors → UI elements
- Each layer is a Zustand store, enabling precise subscriptions and memoization
- Middleware provides interception points for cross-cutting concerns

---

## 3 Factory Helpers (Zustand‑style)

```ts
// 1️⃣  Private Slices (internal implementation)
const createInternalTreeSlice = (set, get) => ({
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
});

// Create private store
const internalTreeStore = create(createInternalTreeSlice);

// 2️⃣  Public Slice (exposes derived state and commands)
const createTreePublicSlice = (set, get, { internalTreeStore }) => ({
  // Public selectors derived from private slice
  isOpen: (id) => internalTreeStore.getState().open.has(id),
  children: (id) =>
    Object.values(internalTreeStore.getState().nodes)
      .filter((n) => n.parent === id),

  // Public commands
  toggleNode: (id: ID) => {
    // Pre-command middleware could be applied here
    internalTreeStore.getState()._toggleNode(id);
    // Post-command middleware could be applied here
  },

  // Props generators
  getTreeProps: () => ({
    role: "tree",
    tabIndex: 0,
  }),

  getTreeItemProps: (id) => ({
    role: "treeitem",
    "aria-expanded": internalTreeStore.getState().open.has(id),
  }),
});

// 3️⃣  Create public store
const treePublicStore = create((set, get) =>
  createTreePublicSlice(set, get, { internalTreeStore })
);

// 4️⃣  Auto-generate selectors
const treeWithSelectors = createSelectors(treePublicStore);

// Helper to create auto-selectors
function createSelectors(store) {
  const enhancedStore = { ...store };
  enhancedStore.use = {};

  for (const key of Object.keys(store.getState())) {
    enhancedStore.use[key] = (params) =>
      useStore(
        store,
        (state) =>
          typeof state[key] === "function" ? state[key](params) : state[key],
      );
  }

  return enhancedStore;
}

// 5️⃣  Package as lattice
export const arboreal = treeWithSelectors;
```

### Composing a **Selection** lattice

```ts
// Private slice for selection
const createInternalSelectionSlice = (set, get) => ({
  selected: new Set<ID>(),

  // Internal state mutation
  _selectNode: (id: ID, multi: boolean) => {
    set((state) => {
      const nextSelected = multi ? new Set(state.selected) : new Set();
      nextSelected.add(id);
      return { ...state, selected: nextSelected };
    });
  },
});

// Create private store
const internalSelectionStore = create(createInternalSelectionSlice);

// Public slice that composes functionality
const createSelectionPublicSlice = (
  set,
  get,
  { internalTreeStore, internalSelectionStore },
) => ({
  // Public selectors
  isSelected: (id) => internalSelectionStore.getState().selected.has(id),

  // Public commands
  selectNode: (id: ID, multi = false) => {
    internalSelectionStore.getState()._selectNode(id, multi);
  },

  // Extended props generators
  getTreeItemProps: (id) => ({
    "aria-selected": internalSelectionStore.getState().selected.has(id),
  }),

  // Middleware/hooks for cross-cutting concerns
  middleware: {
    beforeToggleNode: (id) => {
      // Select the node when toggling (example of cross-cutting concern)
      internalSelectionStore.getState()._selectNode(id, false);
      // Return true to continue execution
      return true;
    },
  },
});

// Compose slices and create selection-enabled tree
export const createArborealWithSelection = () => {
  // Create a combined public store with both slices
  const combinedStore = create((set, get) => ({
    ...createTreePublicSlice(set, get, { internalTreeStore }),
    ...createSelectionPublicSlice(set, get, {
      internalTreeStore,
      internalSelectionStore,
    }),
  }));

  // Apply middleware
  const storeWithMiddleware = applyMiddleware(combinedStore, {
    beforeToggleNode: combinedStore.getState().middleware.beforeToggleNode,
  });

  // Apply prop merging
  const storeWithMergedProps = applyPropMerging(storeWithMiddleware);

  // Auto-generate selectors
  return createSelectors(storeWithMergedProps);
};

// Helper to apply middleware
function applyMiddleware(store, middleware) {
  const enhancedStore = { ...store };
  const originalState = store.getState();

  // Enhance commands with middleware
  for (const [commandName, middlewareFn] of Object.entries(middleware)) {
    if (
      commandName.startsWith("before") && typeof middlewareFn === "function"
    ) {
      const targetCommand = commandName.replace("before", "").toLowerCase();
      const originalCommand = originalState[targetCommand];

      if (typeof originalCommand === "function") {
        enhancedStore.setState({
          [targetCommand]: (...args) => {
            // Run middleware first
            const shouldContinue = middlewareFn(...args);
            // Only run command if middleware returns true
            if (shouldContinue !== false) {
              return originalCommand(...args);
            }
          },
        });
      }
    }
  }

  return enhancedStore;
}

// Helper to merge props
function applyPropMerging(store) {
  const enhancedStore = { ...store };
  const state = store.getState();

  // Find all prop generators (functions starting with 'get' and ending with 'Props')
  const propGenerators = Object.entries(state)
    .filter(([key, value]) =>
      key.startsWith("get") &&
      key.endsWith("Props") &&
      typeof value === "function"
    );

  // Group by base name
  const propGeneratorsByName = propGenerators.reduce((acc, [key, fn]) => {
    const baseName = key.replace(/^get|Props$/g, "");
    if (!acc[baseName]) {
      acc[baseName] = [];
    }
    acc[baseName].push(fn);
    return acc;
  }, {});

  // Create merged prop generators
  for (const [baseName, fns] of Object.entries(propGeneratorsByName)) {
    if (fns.length > 1) {
      const mergedPropGenerator = (params) => {
        return fns.reduce((acc, fn) => ({
          ...acc,
          ...fn(params),
        }), {});
      };

      enhancedStore.setState({
        [`get${baseName}Props`]: mergedPropGenerator,
      });
    }
  }

  return enhancedStore;
}

// Create the combined lattice
export const arborealSelection = createArborealWithSelection();
```

## 5 Drag and Drop Plugin Example

```ts
// Private slice for drag and drop
const createInternalDragDropSlice = (set, get) => ({
  draggingId: null,
  dropTargets: new Set<ID>(),

  _setDragging: (id: ID) => {
    set({ draggingId: id });
  },

  _clearDragging: () => {
    set({ draggingId: null });
  },

  _addDropTarget: (id: ID) => {
    set((state) => ({
      dropTargets: new Set(state.dropTargets).add(id),
    }));
  },

  _removeDropTarget: (id: ID) => {
    set((state) => {
      const newTargets = new Set(state.dropTargets);
      newTargets.delete(id);
      return { dropTargets: newTargets };
    });
  },
});

// Create private store
const internalDragDropStore = create(createInternalDragDropSlice);

// Public slice for drag and drop
const createDragDropPublicSlice = (set, get, {
  internalTreeStore,
  internalSelectionStore,
  internalDragDropStore,
}) => ({
  // Public selectors
  isDragging: (id) => internalDragDropStore.getState().draggingId === id,
  canDrop: (id) => internalDragDropStore.getState().dropTargets.has(id),

  // Public commands
  dragStart: (id) => {
    internalDragDropStore.getState()._setDragging(id);
  },

  drop: (targetId) => {
    const draggingId = internalDragDropStore.getState().draggingId;
    if (draggingId && targetId) {
      // Implement drop logic
      internalDragDropStore.getState()._clearDragging();
      return { success: true, from: draggingId, to: targetId };
    }
    return { success: false };
  },

  // Extended props generators
  getTreeItemProps: (id) => {
    const dragStore = internalDragDropStore.getState();
    const selectionStore = internalSelectionStore.getState();

    return {
      draggable: true,
      "aria-grabbed": dragStore.draggingId === id,
      "data-draggable": selectionStore.selected.has(id),
      onDragStart: () => internalDragDropStore.getState()._setDragging(id),
      onDrop: () => internalDragDropStore.getState()._clearDragging(),
    };
  },

  // Middleware/hooks
  middleware: {
    afterDrop: (result, targetId) => {
      if (result.success) {
        // Additional logic after successful drop
        console.log("Drop completed", result);
      }
    },
  },
});

// Create the full tree with all plugins
export const createFullArboreal = () => {
  // Create a combined public store with all slices
  const combinedStore = create((set, get) => ({
    ...createTreePublicSlice(set, get, { internalTreeStore }),
    ...createSelectionPublicSlice(set, get, {
      internalTreeStore,
      internalSelectionStore,
    }),
    ...createDragDropPublicSlice(set, get, {
      internalTreeStore,
      internalSelectionStore,
      internalDragDropStore,
    }),
  }));

  // Apply all middleware
  const storeWithMiddleware = applyMiddleware(combinedStore, {
    beforeToggleNode: combinedStore.getState().middleware.beforeToggleNode,
    afterDrop: combinedStore.getState().middleware.afterDrop,
  });

  // Apply prop merging
  const storeWithMergedProps = applyPropMerging(storeWithMiddleware);

  // Auto-generate selectors
  return createSelectors(storeWithMergedProps);
};

// Create the full featured lattice
export const arborealFull = createFullArboreal();
```

## 6 Consuming in an app

```ts
// Create a lattice with desired plugins
const tree = createFullArboreal();

// Access via auto-generated selectors
tree.use.isOpen(id); // from tree base
tree.use.isSelected(id); // from selection plugin
tree.use.isDragging(id); // from dragAndDrop plugin

// Call commands directly
tree.getState().toggleNode(id); // from tree base
tree.getState().selectNode(id); // from selection plugin
tree.getState().dragStart(id); // from dragAndDrop plugin

// Get merged props (all plugins contribute)
const itemProps = tree.getState().getTreeItemProps(id);
// Result contains props from tree, selection, and dragAndDrop
```

The system automatically handles:

- Composition of slices into a unified store
- Middleware application for cross-cutting concerns
- Merging of props from different plugins
- Auto-generation of selectors for efficient component rendering

## 7 React Usage Example

```tsx
function TreeNode({ id }: { id: ID }) {
  // Use auto-generated selectors for efficient rendering
  const isOpen = tree.use.isOpen(id);
  const isSelected = tree.use.isSelected(id);
  const props = tree.use.getTreeItemProps(id);

  return (
    <li
      {...props}
      // Props already include all attributes from all plugins
      className={`
        ${isOpen ? "open" : "closed"} 
        ${isSelected ? "selected" : ""}
      `}
      onClick={() => {
        // Execute commands
        const { toggleNode, selectNode } = tree.getState();
        toggleNode(id);
        selectNode(id, false);
      }}
    >
      {isOpen ? "📂" : "📁"} Node {id}
      {/* Children rendered here */}
    </li>
  );
}
```

## 8 Accessibility Strategy

1. **Props carry semantics** → host adapters just spread them on elements.
2. **Shared keyboard map** plugin enforces WCAG navigation patterns.
3. **Playwright + axe** contract tests run for each lattice combo.

---

## 9 Rationale — Why Lattice, not "just hooks"

| When plain hooks shine                         | Where they crack                                                                                       | How Lattice closes the gap                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Small, single‑purpose widget (e.g. accordion). | Complex components like **Tree View** that mix selection, drag‑and‑drop, type‑ahead, virtualisation.   | Composable slices encapsulate each behavior with automatic prop merging and middleware. |
| One framework, one team.                       | **Cross‑framework** design‑system (React + Vue + Native).                                              | Core is JSX‑free; stores are framework‑agnostic; adapters are thin wrappers.            |
| WCAG handled by Radix/Headless UI façade.      | Custom ARIA choreography across multiple behaviours (aria‑grabbed + aria‑selected + roving tab index). | Props merge automatically across plugins, ensuring consistent ARIA attributes.          |
| Logic local to component.                      | Several products need to hot‑swap features (e.g. no DnD on mobile).                                    | Plugins can be composed at instantiation time with consistent patterns.                 |

### Unique value propositions

- **Built on Zustand patterns**: Familiar slice pattern and selector generation.
- **Auto-merging props**: Properties from different plugins merge seamlessly.
- **Middleware system**: Clean interception points for cross-cutting concerns.
- **Explicit private/public separation**: Implementation details remain
  encapsulated.
- **Zustand foundation**: familiar DX, dev‑tools time‑travel, type safety.

> TL;DR — Hooks remain perfect for simple widgets, but once you need **WCAG‑AA,
> pluginability, and portability**, Lattice provides the missing middle layer
> while leveraging familiar Zustand patterns.

---

## 10 Open Questions

- How to best integrate with Zustand's existing middleware ecosystem?
- Should prop generators be more standardized (e.g., naming conventions)?
- What's the right balance of auto-generated code vs explicit interfaces?
- How to handle TypeScript type inference with deep composition?
