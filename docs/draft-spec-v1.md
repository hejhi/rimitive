# Lattice – Draft Spec v0.3 (2025‑04‑29)

A **headless, WCAG‑AA‑ready component framework** built on Zustand. The goal is
React‑first DX with framework‑agnostic core.

---

## 1 Glossary (revised)

| Term              | Meaning                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **Slice / Store** | Private Zustand store created with `createStore`.                                            |
| **Selector**      | Reactive Zustand store derived from one or more slices; consumers subscribe via hooks.       |
| **Props**         | Reactive Zustand store that returns ready-to-spread UI attributes including ARIA properties. |
| **Command**       | Public function that mutates state and can be intercepted with hooks.                        |
| **Hook**          | `onBefore`/`onAfter` callback to intercept commands for cross-cutting concerns.              |
| **Lattice**       | Bundle of selectors, props, commands with namespaces. Lattices can compose other lattices.   |

---

## 2 Mental Model & Flow

```
                   ┌────────────── Reactive Zustand Stores ──────────────┐
                   ▼                      ▼                      ▼
Command + Hooks ──▶ Slice mutation ──▶ Selectors & Props update ──▶ UI re‑render
```

- One‑way data‑flow. Commands update slices. Selectors/Props are read‑only
  derived stores.
- Reactive composition: Private slices → Selectors & Props → UI elements
- Each layer is a Zustand store, enabling precise subscriptions and memoization
- Hooks provide interception points for cross-cutting concerns
  (onBefore/onAfter)

---

## 3 Factory Helpers (Zustand‑style)

```ts
// 1️⃣  Slices (private)
const treeStore = createStore((set, get) => ({
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

// 2️⃣  Selectors (reactive Zustand stores derived from slices)
export const nodeSelectors = createSelector(
  { treeStore }, // source stores
  (get) => ({
    // Returns a Zustand store with these computed values
    isOpen: (id) => get().open.has(id),
    children: (id) => Object.values(get().nodes).filter((n) => n.parent === id),
  }),
);

// 3️⃣  Props (reactive Zustand stores with UI attributes)
const treeProps = createProps(
  "tree",
  {}, // No additional dependencies
  () => ({
    // Returns a Zustand store with DOM/ARIA properties
    role: "tree",
    tabIndex: 0,
  }),
);

const treeItemProps = createProps(
  "treeItem",
  { nodeSelectors }, // Depends on selector store
  (get, { id }) => ({
    // Returns a Zustand store with DOM/ARIA properties
    role: "treeitem",
    "aria-expanded": get(nodeSelectors).isOpen(id), // Subscribes to selector changes
  }),
);

// 4️⃣  Commands (public API with hooks support)
const toggleNode = createCommand(
  (id: ID) => {
    treeStore.getState()._toggleNode(id);
  },
);

// 5️⃣  Package as lattice
export const arboreal = createLattice(
  "arboreal", // namespace key
  {}, // dependencies
  () => ({
    commands: { toggleNode },
    selectors: { nodeSelectors },
    props: { tree: treeProps, treeItem: treeItemProps },
  }),
);
```

### Composing a **Selection** lattice

```ts
import { arboreal, nodeSelectors } from "@lattice/arboreal";

// Slice (private store)
const selectStore = createStore((set) => ({
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

// Selectors (reactive derived store)
export const selectionSelectors = createSelector(
  { selectStore },
  (get) => ({
    isSelected: (id) => get().selected.has(id),
  }),
);

// Commands
const selectNode = createCommand(
  (id: ID, multi = false) => {
    selectStore.getState()._selectNode(id, multi);
  },
);

export const arborealSelection = createLattice(
  "selection", // namespace key
  { arboreal }, // dependencies
  ({ arboreal }) => ({
    commands: { selectNode },
    selectors: { isSelected: selectionSelectors.isSelected },
    props: {
      // Extend the treeItem props with selection props
      treeItem: createProps(
        "treeItem",
        { selectionSelectors },
        (get, { id }) => ({
          // Reactively subscribes to the selection state
          "aria-selected": get(selectionSelectors).isSelected(id),
        }),
      ),
    },
    // Hook into core commands - automatically called during composition
    init: ({ core }) => {
      // When toggling a node, also select it
      core.onBefore("toggleNode", (id) => {
        selectStore.getState()._selectNode(id, false);
      });
    },
  }),
);
```

## 5 Drag and Drop Plugin Example

```ts
export const arborealDragAndDrop = createLattice(
  "dragAndDrop", // namespace key
  { arboreal, arborealSelection }, // dependencies on both base and selection
  ({ arboreal, arborealSelection, core }) => ({
    commands: {
      dragStart: (id) => {/* ... */},
      drop: (targetId) => {/* ... */},
    },
    selectors: {
      isDragging: (id) => {/* ... */},
      canDrop: (id) => {/* ... */},
    },
    props: {
      // Each lattice contributes props to UI parts that are automatically merged
      treeItem: createProps(
        "treeItem",
        { arborealSelection }, // Explicit dependency on other lattice
        (get, { id }) => ({
          draggable: true,
          // Using get() pattern to subscribe to state changes from other stores
          "aria-grabbed": get(/* dragStore */).isDragging(id),
          // Only allow dragging selected items - subscribes to selection state
          "data-draggable": get(arborealSelection.selectors).isSelected(id),
          onDragStart: () => {/* ... */},
          onDrop: () => {/* ... */},
        }),
      ),
    },
    // Hook into existing commands
    init: ({ core }) => {
      // After a drop completes, refresh the tree
      core.onAfter("drop", (result, targetId) => {
        // Additional logic after drop
      });
    },
  }),
);
```

## 6 Consuming in an app

```ts
// Flat composition (system automatically resolves dependencies)
const tree = arboreal.use(arborealSelection, arborealDragAndDrop);

// Access via flat API
tree.commands.toggleNode(id); // from arboreal base
tree.commands.selectNode(id); // from selection plugin
tree.commands.dragStart(id); // from dragAndDrop plugin

// Access via namespaced API (useful for conflicts)
tree.arboreal.commands.toggleNode(id);
tree.selection.commands.selectNode(id);
tree.dragAndDrop.commands.dragStart(id);

// Selectors work the same way
const isOpen = tree.selectors.isOpen(id); // from arboreal base
const isSelected = tree.selectors.isSelected(id); // from selection plugin
const isDragging = tree.selectors.isDragging(id); // from dragAndDrop plugin

// Props always merge contributions from all lattices
const itemProps = tree.props.treeItem({ id });
// Result contains props from arboreal, selection, and dragAndDrop
```

The system automatically handles dependency resolution based on the dependencies
declared in each lattice's factory. Under the hood, command interception works
through a hooks system (onBefore/onAfter) that provides clean integration points
without fragile dependencies between lattices.

## 7 React Usage Example

```tsx
function TreeNode({ id }: { id: ID }) {
  // Use Zustand's useStore pattern to subscribe to the props store
  // Only re-renders when relevant props for this ID change
  const props = useStore(tree.props.treeItem, (props) => props({ id }));

  // Subscribe to specific selectors for conditional rendering
  const isOpen = useStore(tree.selectors.isOpen, (isOpen) => isOpen(id));
  const isSelected = useStore(
    tree.selectors.isSelected,
    (isSelected) => isSelected(id),
  );

  return (
    <li
      {...props}
      // Spread all reactive ARIA, data-attributes, and event handlers
      className={`
        ${isOpen ? "open" : "closed"} 
        ${isSelected ? "selected" : ""}
      `}
      onClick={() => {
        // Execute commands from different lattices
        tree.commands.toggleNode(id);
        tree.commands.selectNode(id, false);
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

| When plain hooks shine                         | Where they crack                                                                                       | How Lattice closes the gap                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Small, single‑purpose widget (e.g. accordion). | Complex components like **Tree View** that mix selection, drag‑and‑drop, type‑ahead, virtualisation.   | Composable lattices encapsulate each behaviour through layered Zustand stores; props merge safely.                        |
| One framework, one team.                       | **Cross‑framework** design‑system (React + Vue + Native).                                              | Core is JSX‑free; stores are framework-agnostic; adapters are thin wrappers.                                              |
| WCAG handled by Radix/Headless UI façade.      | Custom ARIA choreography across multiple behaviours (aria‑grabbed + aria‑selected + roving tab index). | Props are reactive Zustand stores, merged per UI part; shared keyboard plugin enforces WCAG patterns.                     |
| Logic local to component.                      | Several products need to hot‑swap features (e.g. no DnD on mobile).                                    | Feature lattices can be added/removed at instantiation (`arboreal.use(dnd)`), with granular reactivity throughout stores. |

### Unique value propositions

- **Command hooks system**: Clean interception points for cross-cutting concerns
  without boilerplate.
- **Layered Zustand stores**: Slices → Selectors → Props, with precise, granular
  reactivity.
- **Plugin composition**: Behaviours cooperate via hooks—no fragile ref hacks.
- **Zustand foundation**: familiar DX, dev‑tools time‑travel, no custom state
  engine.

> TL;DR — Hooks remain perfect for simple widgets, but once you need **WCAG‑AA,
> pluginability, and portability**, Lattice provides the missing middle layer.

---

## 10 Open Questions

- Hot‑reload boundary: HMR should reuse slices—explore `zustand/middleware`.
- Hook API names: are `onBefore`/`onAfter` intuitive enough?
- Context object shape for props factories—OK to defer until first non‑trivial
  use case.
- Namespace collisions: should TypeScript error or runtime warning?
