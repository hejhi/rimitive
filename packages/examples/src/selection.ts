import { create } from 'zustand';
import {
  createAPI,
  createProps,
  createLattice,
  withStoreSubscribe,
  withProps,
  withLattice,
  LatticeComposer,
} from '../../core/src';

import { NodeID, TreeAPI } from './baseTree';

// Define selection state
interface SelectionState {
  selected: Set<NodeID>;
}

// Define selection API interface
interface SelectionAPI {
  selected: Set<NodeID>;
  isSelected(id: NodeID): boolean;
  selectNode(id: NodeID, multi?: boolean): void;
  deselectNode(id: NodeID): void;
  deselectAll(): void;
}

// Create a selection composable for the tree lattice
export const createSelection = <T extends Partial<TreeAPI>>(): LatticeComposer<
  T,
  SelectionAPI
> => {
  // Return a lattice composer function
  return (baseLattice) => {
    // Create a private selection store
    const selectionStore = create<SelectionState>((_set) => ({
      selected: new Set<NodeID>(),
    }));

    // Create the selection API
    const { api: selectionAPI, hooks: selectionHooks } =
      createAPI<SelectionAPI>(
        withStoreSubscribe({ selectionStore }, ({ selectionStore }) => ({
          // Sync selected nodes from selection store
          selected: selectionStore.selected,
        }))((_set, get) => ({
          // Synced from the store
          selected: new Set<NodeID>(),

          // Getters
          isSelected: (id: NodeID) => get().selected.has(id),

          // Mutations
          selectNode: (id: NodeID, multi = false) => {
            selectionStore.setState((state) => {
              const nextSelected = multi
                ? new Set<NodeID>(state.selected)
                : new Set<NodeID>();
              nextSelected.add(id);
              return { selected: nextSelected };
            });
          },

          deselectNode: (id: NodeID) => {
            selectionStore.setState((state) => {
              const nextSelected = new Set<NodeID>(state.selected);
              nextSelected.delete(id);
              return { selected: nextSelected };
            });
          },

          deselectAll: () => {
            selectionStore.setState({ selected: new Set<NodeID>() });
          },
        }))
      );

    // Create composed tree item props with selection
    const selectionTreeItemProps = createProps(
      'treeItem',
      withProps(baseLattice)((_get, _set, api) => ({
        get: (params: { id: NodeID }) => {
          const id = params.id;
          return {
            'aria-selected': selectionAPI.isSelected(id),
            onClick: (e: MouseEvent) => {
              // Call base onClick if it exists
              const baseProps = api.getBaseProps(params);
              if (baseProps.onClick) {
                baseProps.onClick(e);
              }

              // Handle selection click with multi-select on modifier key
              selectionAPI.selectNode(id, e.shiftKey);
            },
          };
        },
      }))
    );

    // Hook into the base lattice events if needed
    baseLattice.hooks.before('toggleNode', (_id: NodeID) => {
      // We could add pre-expansion logic here if needed
    });

    // Create the composed lattice
    return createLattice(
      'selection',
      withLattice(baseLattice)({
        api: selectionAPI,
        hooks: selectionHooks,
        props: {
          treeItem: selectionTreeItemProps,
        },
      })
    );
  };
};

// Example usage:
/* 
  // Create a tree with selection
  const treeWithSelection = createTreeLattice().use(createSelection());
  
  // Set test data
  treeWithSelection.api.setNodes(createTestTreeData());
  
  // Select a node
  treeWithSelection.api.selectNode("node1");
  
  // Check if a node is selected
  const isSelected = treeWithSelection.api.isSelected("node1");
  console.log("Is node1 selected?", isSelected);
*/
