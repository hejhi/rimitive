# Lattice

A **headless component framework** that lets you build reusable UI behaviors once and use them everywhere. Lattice components are behavior specifications, not UI - they work across React, Vue, vanilla JS, and any rendering system.

## Why Lattice?

Traditional component libraries lock you into their UI decisions and framework choices. Lattice flips this: you define the **behavior** and **state** of your component as contracts, which can power any UI structure in any framework.

```typescript
// Define behavior once
const searchableList = createComponent(/* behavior specification */);

// Use anywhere
<div {...searchableList.view.input}>           // React
<ul {...searchableList.view.results}>          // Any structure  
<MyCustomList {...searchableList.view.list}>  // Your components
```

**Key insight**: Most UI complexity isn't about styling; it's about **state management, interaction patterns, and accessibility**. Lattice lets you solve these once and reuse everywhere.

## A Real Example: Building a File Explorer

Let's build something useful - a file explorer that we'll progressively enhance to show Lattice's power.

### Start Simple: Basic File Tree

```typescript
import { createComponent, createModel, from } from 'lattice';

// Define the core data model
const fileTreeModel = createModel<FileTreeModel>(({ set, get }) => ({
  nodes: [],
  expandedIds: [],
  
  loadNodes: async (path) => {
    const nodes = await fetchFiles(path);
    set({ nodes });
  },
  
  toggleExpanded: (nodeId) => {
    const expanded = get().expandedIds;
    const isExpanded = expanded.includes(nodeId);
    set({ 
      expandedIds: isExpanded 
        ? expanded.filter(id => id !== nodeId)
        : [...expanded, nodeId]
    });
  }
}));

// Create the basic component
const fileTree = createComponent(() => {
  const model = fileTreeModel;
  
  // Actions are pure intent - they delegate to model methods
  const actions = from(model).createActions(({ model }) => ({
    expandFolder: model().toggleExpanded,
    loadFiles: model().loadNodes,
  }));
  
  const selectors = from(model).createSelectors(({ model }) => ({
    nodes: model().nodes,
    isExpanded: (nodeId) => model().expandedIds.includes(nodeId),
  }));
  
  const folderView = from(selectors)
    .withActions(actions)
    .createView(({ selectors, actions }) => ({
      'aria-expanded': (nodeId) => selectors().isExpanded(nodeId),
      'role': 'treeitem',
      onClick: (nodeId) => actions().expandFolder(nodeId), // Pure intent call
    }));
  
  return { model, actions, selectors, view: { folder: folderView } };
});
```

**What you get**: A working file tree with proper accessibility, clean state management, and no framework dependencies.

## Progressive Enhancement: Add Selection

Now let's add file selection without changing our existing code:

```typescript
// Extend the model with selection capability
const selectableFileModel = createModel<FileTreeModel & SelectionModel>(
  (tools) => ({
    ...fileTreeModel()(tools),
    selectedIds: [],
    
    selectFile: (fileId) => {
      tools.set({ selectedIds: [fileId] });
    },
    
    selectMultiple: (fileIds) => {
      tools.set({ selectedIds: fileIds });
    }
  })
);

// Enhanced component with selection
const selectableFileTree = createComponent(
  withComponent(fileTree, ({ model, view, actions, selectors }) => {
    const enhancedModel = selectableFileModel;
    
    // Actions remain pure intent
    const enhancedActions = from(enhancedModel).createActions(
      ({ model }) => ({
        ...actions()({ model }),
        selectFile: model().selectFile,
        selectAll: model().selectMultiple,
      })
    );
    
    const enhancedSelectors = from(enhancedModel).createSelectors(
      ({ model }) => ({
        ...selectors()({ model }),
        selectedFiles: model().selectedIds,
        isSelected: (fileId) => model().selectedIds.includes(fileId),
      })
    );
    
    const fileView = from(enhancedSelectors)
      .withActions(enhancedActions)
      .createView(({ actions, selectors }) => ({
        ...view.folder()({ actions, selectors }),
        'aria-selected': (fileId) => selectors().isSelected(fileId),
        onClick: (fileId, event) => {
          // View logic combines multiple intents
          if (event.ctrlKey) {
            actions().selectFile(fileId);      // Pure intent
          } else {
            actions().expandFolder(fileId);    // Pure intent
          }
        },
      }));
    
    return {
      model: enhancedModel,
      actions: enhancedActions,
      selectors: enhancedSelectors,
      view: { folder: view.folder, file: fileView },
    };
  })
);
```

**Key insight**: Your basic tree still works unchanged. Selection is layered on top without breaking existing functionality.

## Framework Agnostic Usage

The same component works across any framework:

### React
```tsx
function FileExplorer() {
  const { nodes, isSelected } = useSelectors(selectableFileTree);
  const { selectFile, expandFolder } = useActions(selectableFileTree);
  
  return (
    <div role="tree">
      {nodes.map(node => (
        <div key={node.id} {...selectableFileTree.view.file(node.id)}>
          {node.name}
        </div>
      ))}
    </div>
  );
}
```

### Vue
```vue
<template>
  <div role="tree">
    <div v-for="node in nodes" v-bind="getFileProps(node.id)">
      {{ node.name }}
    </div>
  </div>
</template>

<script>
export default {
  setup() {
    const { nodes } = useSelectors(selectableFileTree);
    const getFileProps = (nodeId) => selectableFileTree.view.file(nodeId);
    return { nodes, getFileProps };
  }
}
</script>
```

### Vanilla JavaScript
```javascript
const explorer = selectableFileTree();
const container = document.getElementById('file-tree');

explorer.selectors.nodes.forEach(node => {
  const element = document.createElement('div');
  Object.assign(element, explorer.view.file(node.id));
  element.textContent = node.name;
  container.appendChild(element);
});
```

## Why This Approach Works

### 1. **Behavior as Data**
Views are pure attribute objects, not components. This means:
- Any UI structure can consume them
- No framework lock-in
- Easy to test and reason about

### 2. **Progressive Composition**
Start simple, add complexity only when needed:
- Basic tree � Selection � Drag-drop � Keyboard navigation
- Each layer enhances without breaking previous functionality
- Reuse behaviors across different component types

### 3. **No Prop Drilling**
Different parts of your UI access exactly what they need:

```typescript
// Toolbar only needs selection info
function FileToolbar() {
  const { selectedFiles } = useSelectors(selectableFileTree);
  return <div>Selected: {selectedFiles.length} files</div>;
}

// Tree nodes only need their specific state
function FileNode({ nodeId }) {
  const { isSelected } = useSelectors(selectableFileTree);
  const { selectFile } = useActions(selectableFileTree);
  
  const handleClick = () => {
    selectFile(nodeId); // Pure intent call
  };
  
  // Only re-renders when this node's state changes
}
```

### 4. **Framework Performance**
Unlike React Context or global stores:
- Components subscribe to specific data slices
- Fine-grained updates without ceremony
- No unnecessary re-renders

## Real-World Benefits

### Component Libraries
Instead of shipping React components, ship behavior specifications:
```typescript
// Your library exports behaviors, not UI
export const DataGrid = createComponent(/* data grid behavior */);
export const Calendar = createComponent(/* calendar behavior */);

// Users apply them to their UI systems
<MyTable {...DataGrid.view.table}>
<MyCustomCalendar {...Calendar.view.month}>
```

### Design Systems
Separate behavior from design:
- Design team handles styling and layout
- Engineering team handles behavior and accessibility
- Behaviors work across different design implementations

### Cross-Platform Development
Same logic works on web, mobile, desktop:
```typescript
// Web
<div {...fileTree.view.folder}>

// React Native  
<TouchableOpacity {...fileTree.view.folder}>

// Desktop (Electron)
<button {...fileTree.view.folder}>
```

## Possibilities: Framework-Specific View Recomposition

One of Lattice's most powerful capabilities is **view recomposition** - the ability to take the same behavior specification and adapt it to different frameworks, design systems, and architectural patterns.

### Component Libraries Ship Behavior + Base Views

```typescript
// Component library ships semantic behavior
const TreeComponent = createComponent(() => {
  // ... model, actions, selectors remain framework-agnostic
  
  // Base views provide semantic HTML and accessibility
  const nodeView = from(selectors)
    .withActions(actions)
    .createView(({ selectors, actions }) => ({
      'role': 'treeitem',
      'aria-expanded': (nodeId) => selectors().isExpanded(nodeId),
      'aria-selected': (nodeId) => selectors().isSelected(nodeId),
      'tabIndex': 0,
      onClick: (nodeId) => actions().toggleNode(nodeId),
    }));
    
  return { model, actions, selectors, view: { node: nodeView } };
});
```

### Users Recompose for Their Context

**Design System Integration:**
```typescript
// Same tree behavior, Material-UI components
const materialTree = TreeComponent./* recompose for Material-UI */;

// Same tree behavior, Chakra UI components  
const chakraTree = TreeComponent./* recompose for Chakra UI */;

// Same tree behavior, custom design system
const customTree = TreeComponent./* recompose for custom components */;
```

**Framework-Specific Adaptations:**
```typescript
// React SPA with rich interactions
const reactTree = TreeComponent./* rich component composition */;

// HTMX hypermedia with server-driven updates
const htmxTree = TreeComponent./* HTMX attribute generation */;

// Vue with reactive templates
const vueTree = TreeComponent./* Vue-specific optimizations */;
```

### Implications

**One Behavior Specification Becomes:**
- React + Material-UI (rich SPA)
- Vue + custom CSS (traditional web app) 
- HTMX + semantic HTML (server-driven)
- React Native + platform components (mobile)
- Svelte + design tokens (performance-optimized)

**Component authors** define behavior once. **Users adapt** that behavior to their:
- Framework (React, Vue, HTMX, Svelte)
- Design system (Material, Chakra, custom)
- Architecture (SPA, SSR, hypermedia)
- Platform (web, mobile, desktop)

This means a single `TreeComponent` from npm could power file explorers in React apps, project browsers in Vue applications, and navigation menus in HTMX-driven sites - each with their own look, feel, and interaction patterns, but sharing the same proven behavior logic underneath.

### Beyond Traditional Component Libraries

Instead of shipping pre-built React components that lock users into specific styling and framework choices, component libraries become **behavior specifications** that users adapt to their exact needs. This creates reusability while maintaining complete design and architectural freedom.

## Getting Started

```typescript
import { createComponent, createModel, from } from 'lattice';

// Start building behaviors that work everywhere
```

**Next**: Check out our [guides](./docs) to build your first component, or explore our [examples](./examples) to see Lattice in action with complex real-world components.

---

**Core Philosophy**: UI complexity isn't about rendering. It's about behavior. Lattice lets you solve behavior once and use it everywhere.