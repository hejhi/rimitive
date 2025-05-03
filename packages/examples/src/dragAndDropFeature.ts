import { create } from 'zustand';
import {
  createAPI,
  createProps,
  createLattice,
  withStoreSync,
  withProps,
  withLattice,
  LatticeEnhancer,
} from '../../core/src';

import { NodeID, TreeAPI } from './baseTree';

// Define drag-and-drop state
interface DragDropState {
  draggingId: NodeID | null;
  dragOverId: NodeID | null;
  validDropTargets: Set<NodeID>;
}

// Define drop result type
interface DropResult {
  success: boolean;
  source?: NodeID;
  target?: NodeID;
  error?: string;
}

// Define drag-and-drop API
interface DragDropAPI {
  draggingId: NodeID | null;
  dragOverId: NodeID | null;
  validDropTargets: Set<NodeID>;
  isDragging: (id: NodeID) => boolean;
  isValidDropTarget: (id: NodeID) => boolean;
  isDraggedOver: (id: NodeID) => boolean;
  startDrag: (id: NodeID) => void;
  endDrag: () => void;
  setDragOver: (id: NodeID | null) => void;
  updateValidDropTargets: (targetIds: NodeID[]) => void;
  processDrop: (targetId: NodeID) => DropResult;
}

// Create a drag-and-drop feature
export const createDragAndDropFeature = <
  T extends Partial<TreeAPI>,
>(): LatticeEnhancer<T, DragDropAPI> => {
  return (baseLattice) => {
    // Private slice for drag-and-drop state
    const dragDropStore = create<DragDropState>((_set) => ({
      draggingId: null,
      dragOverId: null,
      validDropTargets: new Set<NodeID>(),
    }));

    // Create the drag-and-drop API
    const { api: dragDropAPI, hooks: dragDropHooks } = createAPI<DragDropAPI>(
      withStoreSync({ dragDropStore }, ({ dragDropStore }) => ({
        draggingId: dragDropStore.draggingId,
        dragOverId: dragDropStore.dragOverId,
        validDropTargets: dragDropStore.validDropTargets,
      }))((_set, get) => ({
        // Synced from store
        draggingId: null,
        dragOverId: null,
        validDropTargets: new Set<NodeID>(),

        // Getters
        isDragging: (id: NodeID) => get().draggingId === id,

        isValidDropTarget: (id: NodeID) => get().validDropTargets.has(id),

        isDraggedOver: (id: NodeID) => get().dragOverId === id,

        // Mutations
        startDrag: (id: NodeID) => {
          dragDropStore.setState({
            draggingId: id,
            // We could compute valid drop targets here based on tree structure
            validDropTargets: new Set<NodeID>(),
          });
        },

        endDrag: () => {
          dragDropStore.setState({
            draggingId: null,
            dragOverId: null,
            validDropTargets: new Set<NodeID>(),
          });
        },

        setDragOver: (id: NodeID | null) => {
          dragDropStore.setState({ dragOverId: id });
        },

        updateValidDropTargets: (targetIds: NodeID[]) => {
          dragDropStore.setState({
            validDropTargets: new Set<NodeID>(targetIds),
          });
        },

        processDrop: (targetId: NodeID): DropResult => {
          const { draggingId, validDropTargets } = get();

          // No drag in progress
          if (!draggingId) {
            return { success: false, error: 'No drag in progress' };
          }

          // Check if this is a valid drop target
          if (!validDropTargets.has(targetId)) {
            return {
              success: false,
              source: draggingId,
              target: targetId,
              error: 'Invalid drop target',
            };
          }

          // Reset drag state
          dragDropStore.setState({
            draggingId: null,
            dragOverId: null,
            validDropTargets: new Set<NodeID>(),
          });

          // Return successful result
          return {
            success: true,
            source: draggingId,
            target: targetId,
          };
        },
      }))
    );

    // Create tree props for drag and drop
    const treeProps = createProps(
      'tree',
      withProps(baseLattice)((_get, _set, _api) => ({
        get: () => ({
          onDragEnd: () => {
            // Clean up drag state when drag ends without drop
            dragDropAPI.endDrag();
          },
        }),
      }))
    );

    // Create tree item props for drag and drop
    const treeItemProps = createProps(
      'treeItem',
      withProps(baseLattice)((_get, _set, _api) => ({
        get: (params: { id: NodeID }) => {
          const id = params.id;
          const isDragging = dragDropAPI.isDragging(id);
          const isValidDropTarget = dragDropAPI.isValidDropTarget(id);
          const isDraggedOver = dragDropAPI.isDraggedOver(id);

          return {
            draggable: true,
            'aria-grabbed': isDragging || undefined,
            'data-dragging': isDragging ? 'true' : undefined,
            'data-droppable': isValidDropTarget ? 'true' : undefined,
            'data-dragover': isDraggedOver ? 'true' : undefined,
            onDragStart: (e: DragEvent) => {
              // Set dragging data for dataTransfer
              if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', id);
                e.dataTransfer.effectAllowed = 'move';
              }

              // Update drag state
              dragDropAPI.startDrag(id);

              // Compute valid drop targets based on tree structure
              // For simplicity, we'll allow dropping on any node except itself
              // You could add more complex rules here
              const treeAPI = baseLattice.api.getState();
              const allNodes = treeAPI.nodes ? Object.keys(treeAPI.nodes) : [];
              const validTargets = allNodes.filter((nodeId) => nodeId !== id);
              dragDropAPI.updateValidDropTargets(validTargets);
            },

            onDragOver: (e: DragEvent) => {
              // Only allow dropping if this is a valid target
              if (isValidDropTarget) {
                e.preventDefault();
                e.stopPropagation();

                // Update drag over state
                dragDropAPI.setDragOver(id);

                // Set drop effect
                if (e.dataTransfer) {
                  e.dataTransfer.dropEffect = 'move';
                }
              }
            },

            onDragLeave: () => {
              // Clear drag over state if this node was being dragged over
              if (isDraggedOver) {
                dragDropAPI.setDragOver(null);
              }
            },

            onDrop: (e: DragEvent) => {
              e.preventDefault();
              e.stopPropagation();

              // Process the drop
              const result = dragDropAPI.processDrop(id);

              // If drop was successful, update the tree
              if (result.success && result.source && result.target) {
                const source = result.source;
                const target = result.target;

                // Here you would update your tree structure
                // For example, you might:
                // 1. Remove the node from its current parent
                // 2. Add it to the new parent's children
                // 3. Update the nodes in the store

                // For this example, we'll just log the result
                console.log(`Moved node ${source} to ${target}`);

                // Hook for after drop processing
                dragDropHooks.after('processDrop', (result: DropResult) => {
                  // You could trigger additional actions here
                  return result;
                });
              }
            },
          };
        },
      }))
    );

    // Create the enhanced lattice
    return createLattice(
      'dragAndDrop',
      withLattice(baseLattice)({
        api: dragDropAPI,
        hooks: dragDropHooks,
        props: {
          tree: treeProps,
          treeItem: treeItemProps,
        },
      })
    );
  };
};

// Example usage:
/*
  // Create a tree with drag and drop
  const treeWithDnd = createTreeLattice().use(createDragAndDropFeature());
  
  // Set test data
  treeWithDnd.api.setNodes(createTestTreeData());
  
  // Custom drag end handler
  treeWithDnd.hooks.after('processDrop', (result) => {
    console.log('Drop completed:', result);
    
    if (result.success && result.source && result.target) {
      // Update your application state here
      // For example, update a backend database or trigger other UI updates
    }
    
    return result;
  });
*/
