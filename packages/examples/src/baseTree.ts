import { create } from 'zustand';
import {
  createAPI,
  createProps,
  createLattice,
  withStoreSubscribe,
  Lattice as LatticeType,
} from '../../core/src';

// Define types for our tree
export type NodeID = string;

export interface TreeNode {
  id: NodeID;
  name: string;
  children?: NodeID[];
}

export interface TreeState {
  nodes: Record<NodeID, TreeNode>;
  expanded: Set<NodeID>;
}

// Create base tree API interface
export interface TreeAPI {
  nodes: Record<NodeID, TreeNode>;
  expanded: Set<NodeID>;
  getNode: (id: NodeID) => TreeNode | undefined;
  hasChildren: (id: NodeID) => boolean;
  isExpanded: (id: NodeID) => boolean;
  getChildNodes: (id: NodeID) => TreeNode[];
  setNodes: (nodes: Record<NodeID, TreeNode>) => void;
  toggleNode: (id: NodeID) => void;
}

// Export the Lattice type for extensions
export type Lattice<T = any> = LatticeType<T>;

// Type for withStoreSubscribe state
interface StoresState {
  treeStore: {
    nodes: Record<NodeID, TreeNode>;
    expanded: Set<NodeID>;
  };
}

// Create a base tree lattice factory
export const createTreeLattice = () => {
  // Create our private slice
  const treeStore = create<TreeState>(() => ({
    nodes: {},
    expanded: new Set(),
  }));

  // Create the API with store synchronization
  const { api, hooks } = createAPI<TreeAPI>(
    withStoreSubscribe({ treeStore }, (state) => ({
      // Sync these values from the tree store
      nodes: state.treeStore.nodes,
      expanded: state.treeStore.expanded,
    }))((_set, get) => ({
      // Pass through synced properties
      nodes: {} as Record<NodeID, TreeNode>, // Will be provided by withStoreSubscribe
      expanded: new Set<NodeID>(), // Will be provided by withStoreSubscribe

      // Getters
      getNode: (id: NodeID) => get().nodes[id],

      hasChildren: (id: NodeID) => {
        const node = get().nodes[id];
        return !!(node && node.children && node.children.length > 0);
      },

      isExpanded: (id: NodeID) => get().expanded.has(id),

      getChildNodes: (id: NodeID) => {
        const node = get().nodes[id];
        if (!node || !node.children) return [];
        return (
          node.children
            .map((childId: NodeID) => get().nodes[childId])
            // @ts-ignore - Ignoring filter type inference
            .filter((node) => node !== undefined)
        );
      },

      // Mutations
      setNodes: (nodes: Record<NodeID, TreeNode>) => {
        treeStore.setState({ nodes });
      },

      toggleNode: (id: NodeID) => {
        treeStore.setState((state) => {
          const nextExpanded = new Set(state.expanded);
          if (nextExpanded.has(id)) {
            nextExpanded.delete(id);
          } else {
            nextExpanded.add(id);
          }
          return { expanded: nextExpanded };
        });
      },
    }))
  );

  // Create tree props
  const treeProps = createProps(
    'tree',
    // @ts-ignore - Ignoring prop function parameter types
    (_set, _get) => ({
      get: () => ({
        role: 'tree',
        'aria-label': 'Tree navigation',
      }),
    })
  );

  // Create tree item props
  const treeItemProps = createProps(
    'treeItem',
    // @ts-ignore - Ignoring prop function parameter types
    (_set, _get) => ({
      get: (params: { id: NodeID }) => {
        const id = params.id;
        const hasChildren = api.getState().hasChildren(id);
        const isExpanded = api.getState().isExpanded(id);

        return {
          role: 'treeitem',
          'aria-expanded': hasChildren ? isExpanded : undefined,
          onClick: () => {
            api.getState().toggleNode(id);
          },
        };
      },
    })
  );

  // Create our lattice
  return createLattice('tree', {
    api,
    hooks,
    props: {
      tree: treeProps,
      treeItem: treeItemProps,
    },
  });
};

// Helper to create a simple test tree data structure
export const createTestTreeData = (): Record<NodeID, TreeNode> => {
  return {
    root: {
      id: 'root',
      name: 'Root',
      children: ['node1', 'node2', 'node3'],
    },
    node1: {
      id: 'node1',
      name: 'Node 1',
      children: ['node1-1', 'node1-2'],
    },
    node2: {
      id: 'node2',
      name: 'Node 2',
    },
    node3: {
      id: 'node3',
      name: 'Node 3',
      children: ['node3-1'],
    },
    'node1-1': {
      id: 'node1-1',
      name: 'Node 1.1',
    },
    'node1-2': {
      id: 'node1-2',
      name: 'Node 1.2',
    },
    'node3-1': {
      id: 'node3-1',
      name: 'Node 3.1',
    },
  };
};
