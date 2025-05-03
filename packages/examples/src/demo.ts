import {
  createTreeLattice,
  createTestTreeData,
  NodeID,
  TreeNode,
} from './baseTree';
import { createSelection } from './selection';
import { createDragAndDrop } from './dragAndDrop';

/**
 * Interactive demo showing how to use the Lattice framework to create a tree with
 * selection and drag-and-drop capabilities
 */

// Create styles
const style = document.createElement('style');
style.textContent = `
.tree-container {
  font-family: system-ui, -apple-system, sans-serif;
  margin: 20px;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 15px;
  max-width: 400px;
  background: #f9f9f9;
}

.tree-item {
  padding: 5px 10px;
  margin: 2px 0;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.tree-item:hover {
  background-color: #f0f0f0;
}

.tree-item.selected {
  background-color: #e6f7ff;
  border-left: 2px solid #1890ff;
}

.tree-item.dragging {
  opacity: 0.5;
}

.tree-item.drop-target {
  border: 1px dashed #1890ff;
}

.children {
  margin-left: 20px;
  border-left: 1px solid #ddd;
  padding-left: 10px;
}

.tree-controls {
  margin-bottom: 15px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 4px;
}

.toggle {
  margin-right: 5px;
  cursor: pointer;
  display: inline-block;
  width: 16px;
  text-align: center;
}

.status-bar {
  margin-top: 15px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
}
`;
document.head.appendChild(style);

// Create tree container
const treeContainer = document.createElement('div');
treeContainer.className = 'tree-container';
document.body.appendChild(treeContainer);

// Create controls
const controlsDiv = document.createElement('div');
controlsDiv.className = 'tree-controls';
controlsDiv.innerHTML = `
  <h3>Tree Demo</h3>
  <button id="expand-all">Expand All</button>
  <button id="collapse-all">Collapse All</button>
  <button id="reset-tree">Reset Tree</button>
`;
treeContainer.appendChild(controlsDiv);

// Create status bar
const statusBar = document.createElement('div');
statusBar.className = 'status-bar';
statusBar.textContent = 'Ready';

// Create a basic tree lattice
console.log('Creating base tree lattice...');
const baseLattice = createTreeLattice();

// Initialize with test data
const testData = createTestTreeData();
baseLattice.api.getState().setNodes(testData);

// Create factories for our composable lattices
const selection = createSelection();
const dragAndDrop = createDragAndDrop();

// Create our tree with both composable lattices and proper typing
const tree = baseLattice.use(selection).use(dragAndDrop);

// Add status updates via hooks
tree.hooks.after('selectNode', (_: any, id: string) => {
  updateStatus(`Selected node: ${id}`);
});

tree.hooks.after(
  'processDrop',
  (result: { success: boolean; target?: string; source?: string }) => {
    if (result.success && result.target && result.source) {
      updateStatus(`Moved node ${result.source} to ${result.target}`);
      if (result.target) {
        tree.api.getState().selectNode(result.target);
      }
    }
    return result;
  }
);

function updateStatus(message: string) {
  statusBar.textContent = message;
  console.log(message);
}

// Function to render the entire tree
function renderTree() {
  const treeDiv = document.createElement('div');
  treeDiv.className = 'tree';

  // Get root nodes - in this structure, 'root' is the top level node
  // We find it by checking for id === 'root'
  const nodes = tree.api.getState().nodes;
  const rootNode = nodes['root'];

  if (rootNode) {
    const nodeElement = renderNode(rootNode.id);
    treeDiv.appendChild(nodeElement);
  }

  // Replace the current tree with the new one
  const existingTree = treeContainer.querySelector('.tree');
  if (existingTree) {
    treeContainer.replaceChild(treeDiv, existingTree);
  } else {
    treeContainer.appendChild(treeDiv);
  }

  // Add the status bar at the end
  if (treeContainer.contains(statusBar)) {
    treeContainer.removeChild(statusBar);
  }
  treeContainer.appendChild(statusBar);
}

// Function to render a single node and its children
function renderNode(id: NodeID) {
  const api = tree.api.getState();
  const node = api.getNode(id);
  if (!node) return document.createElement('div');

  const hasChildren = api.hasChildren(id);
  const isExpanded = api.isExpanded(id);
  const isSelected = api.isSelected(id);
  const isDragging = api.isDragging(id);
  const isValidDropTarget = api.isValidDropTarget(id);

  // Create the node element
  const nodeElement = document.createElement('div');
  nodeElement.className = 'tree-item';
  nodeElement.dataset.id = id;

  // Add appropriate classes based on state
  if (isSelected) nodeElement.classList.add('selected');
  if (isDragging) nodeElement.classList.add('dragging');
  if (isValidDropTarget) nodeElement.classList.add('drop-target');

  // Create the expand/collapse toggle
  const toggle = document.createElement('span');
  toggle.className = 'toggle';
  if (hasChildren) {
    toggle.textContent = isExpanded ? '▼' : '►';
    toggle.onclick = (e) => {
      e.stopPropagation();
      api.toggleNode(id);
      renderTree();
    };
  } else {
    toggle.textContent = ' ';
  }

  // Create the node label
  const label = document.createElement('span');
  label.textContent = node.name;

  // Add toggle and label to the node element
  nodeElement.appendChild(toggle);
  nodeElement.appendChild(label);

  // Set up event listeners for selection
  nodeElement.onclick = (e) => {
    const multiSelect = e.ctrlKey || e.metaKey;
    api.selectNode(id, multiSelect);
    renderTree();
  };

  // Set up drag and drop event listeners
  nodeElement.draggable = true;
  nodeElement.ondragstart = (e) => {
    api.startDrag(id);
    renderTree();

    // Required for Firefox
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  nodeElement.ondragover = (e) => {
    // Allow drop
    e.preventDefault();

    // Don't allow dropping onto itself
    if (api.isDragging(id)) return;

    api.updateValidDropTargets([id]);
    renderTree();
  };

  nodeElement.ondragleave = () => {
    api.updateValidDropTargets([]);
    renderTree();
  };

  nodeElement.ondrop = (e) => {
    e.preventDefault();
    api.processDrop(id);
    renderTree();
  };

  nodeElement.ondragend = () => {
    api.endDrag();
    renderTree();
  };

  // Render children if expanded
  if (hasChildren && isExpanded) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'children';

    api.getChildNodes(id).forEach((childNode: TreeNode) => {
      const childElement = renderNode(childNode.id);
      childrenContainer.appendChild(childElement);
    });

    nodeElement.appendChild(childrenContainer);
  }

  return nodeElement;
}

// Set up control buttons
document.getElementById('expand-all')?.addEventListener('click', () => {
  const api = tree.api.getState();
  Object.keys(api.nodes).forEach((nodeId) => {
    if (api.hasChildren(nodeId) && !api.isExpanded(nodeId)) {
      api.toggleNode(nodeId);
    }
  });
  renderTree();
  updateStatus('All nodes expanded');
});

document.getElementById('collapse-all')?.addEventListener('click', () => {
  const api = tree.api.getState();
  Object.keys(api.nodes).forEach((nodeId) => {
    if (api.hasChildren(nodeId) && api.isExpanded(nodeId)) {
      api.toggleNode(nodeId);
    }
  });
  renderTree();
  updateStatus('All nodes collapsed');
});

document.getElementById('reset-tree')?.addEventListener('click', () => {
  tree.api.getState().setNodes(createTestTreeData());
  renderTree();
  updateStatus('Tree reset to default state');
});

// Initial render
renderTree();
updateStatus('Tree initialized');

// Instructions
console.log('Interactive Tree Demo:');
console.log('- Click on nodes to select them');
console.log('- Use Ctrl/Cmd+Click for multi-select');
console.log('- Drag and drop nodes to rearrange the tree');
