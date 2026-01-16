import { devtoolsContext } from './devtoolsCtx';
import type {
  GraphState,
  GraphNode,
  GraphEdge,
  FocusedGraphView,
} from './graphTypes';

/**
 * Initialize empty graph state
 */
function createEmptyGraphState(): GraphState {
  return {
    nodes: new Map(),
    edges: new Map(),
    dependencies: new Map(),
    dependents: new Map(),
  };
}

/**
 * Reactive graph state signal
 */
export const graphState = devtoolsContext.signal<GraphState>(
  createEmptyGraphState()
);

/**
 * Selected node ID for focused view
 */
export const selectedNodeId = devtoolsContext.signal<string | null>(null);

/**
 * Add or update a node in the graph
 */
export function addNode(node: GraphNode): void {
  const state = graphState();
  const newNodes = new Map(state.nodes);
  newNodes.set(node.id, node);

  graphState({
    ...state,
    nodes: newNodes,
  });
}

/**
 * Remove a node and all its edges from the graph
 */
export function removeNode(nodeId: string): void {
  const state = graphState();
  const newState = { ...state };

  // Remove node
  const newNodes = new Map(state.nodes);
  newNodes.delete(nodeId);
  newState.nodes = newNodes;

  // Remove all edges involving this node
  const newEdges = new Map(state.edges);
  const newDependencies = new Map(state.dependencies);
  const newDependents = new Map(state.dependents);

  // Remove edges where this node is consumer
  const deps = state.dependencies.get(nodeId);
  if (deps) {
    for (const producerId of deps) {
      const edgeId = `${nodeId}->${producerId}`;
      newEdges.delete(edgeId);

      // Remove from producer's dependents
      const producerDeps = newDependents.get(producerId);
      if (producerDeps) {
        const newSet = new Set(producerDeps);
        newSet.delete(nodeId);
        if (newSet.size === 0) {
          newDependents.delete(producerId);
        } else {
          newDependents.set(producerId, newSet);
        }
      }
    }
    newDependencies.delete(nodeId);
  }

  // Remove edges where this node is producer
  const dependents = state.dependents.get(nodeId);
  if (dependents) {
    for (const consumerId of dependents) {
      const edgeId = `${consumerId}->${nodeId}`;
      newEdges.delete(edgeId);

      // Remove from consumer's dependencies
      const consumerDeps = newDependencies.get(consumerId);
      if (consumerDeps) {
        const newSet = new Set(consumerDeps);
        newSet.delete(nodeId);
        if (newSet.size === 0) {
          newDependencies.delete(consumerId);
        } else {
          newDependencies.set(consumerId, newSet);
        }
      }
    }
    newDependents.delete(nodeId);
  }

  newState.edges = newEdges;
  newState.dependencies = newDependencies;
  newState.dependents = newDependents;

  graphState(newState);

  // Clear selection if the removed node was selected
  if (selectedNodeId() === nodeId) {
    selectedNodeId(null);
  }
}

/**
 * Add an edge to the graph (consumer depends on producer)
 */
export function addEdge(edge: GraphEdge): void {
  const state = graphState();
  const { id, producerId, consumerId } = edge;

  // Skip if edge already exists
  if (state.edges.has(id)) return;

  const newEdges = new Map(state.edges);
  const newDependencies = new Map(state.dependencies);
  const newDependents = new Map(state.dependents);

  // Add edge
  newEdges.set(id, edge);

  // Add to consumer's dependencies
  const deps = newDependencies.get(consumerId);
  if (deps) {
    const newSet = new Set(deps);
    newSet.add(producerId);
    newDependencies.set(consumerId, newSet);
  } else {
    newDependencies.set(consumerId, new Set([producerId]));
  }

  // Add to producer's dependents
  const dependentSet = newDependents.get(producerId);
  if (dependentSet) {
    const newSet = new Set(dependentSet);
    newSet.add(consumerId);
    newDependents.set(producerId, newSet);
  } else {
    newDependents.set(producerId, new Set([consumerId]));
  }

  graphState({
    ...state,
    edges: newEdges,
    dependencies: newDependencies,
    dependents: newDependents,
  });
}

/**
 * Remove an edge from the graph
 */
export function removeEdge(consumerId: string, producerId: string): void {
  const edgeId = `${consumerId}->${producerId}`;
  const state = graphState();

  // Skip if edge doesn't exist
  if (!state.edges.has(edgeId)) return;

  const newEdges = new Map(state.edges);
  const newDependencies = new Map(state.dependencies);
  const newDependents = new Map(state.dependents);

  // Remove edge
  newEdges.delete(edgeId);

  // Remove from consumer's dependencies
  const deps = newDependencies.get(consumerId);
  if (deps) {
    const newSet = new Set(deps);
    newSet.delete(producerId);
    if (newSet.size === 0) {
      newDependencies.delete(consumerId);
    } else {
      newDependencies.set(consumerId, newSet);
    }
  }

  // Remove from producer's dependents
  const dependentSet = newDependents.get(producerId);
  if (dependentSet) {
    const newSet = new Set(dependentSet);
    newSet.delete(consumerId);
    if (newSet.size === 0) {
      newDependents.delete(producerId);
    } else {
      newDependents.set(producerId, newSet);
    }
  }

  graphState({
    ...state,
    edges: newEdges,
    dependencies: newDependencies,
    dependents: newDependents,
  });
}

/**
 * Get a focused view of the graph centered on a node
 */
export function getFocusedView(nodeId: string): FocusedGraphView | null {
  const state = graphState();
  const center = state.nodes.get(nodeId);

  if (!center) return null;

  // Get dependency nodes
  const depIds = state.dependencies.get(nodeId) ?? new Set();
  const dependencies = Array.from(depIds)
    .map((id) => state.nodes.get(id))
    .filter((node): node is GraphNode => node !== undefined);

  // Get dependent nodes
  const dependentIds = state.dependents.get(nodeId) ?? new Set();
  const dependents = Array.from(dependentIds)
    .map((id) => state.nodes.get(id))
    .filter((node): node is GraphNode => node !== undefined);

  // Get dependency edges
  const dependencyEdges = Array.from(depIds)
    .map((producerId) => state.edges.get(`${nodeId}->${producerId}`))
    .filter((edge): edge is GraphEdge => edge !== undefined);

  // Get dependent edges
  const dependentEdges = Array.from(dependentIds)
    .map((consumerId) => state.edges.get(`${consumerId}->${nodeId}`))
    .filter((edge): edge is GraphEdge => edge !== undefined);

  return {
    center,
    dependencies,
    dependents,
    dependencyEdges,
    dependentEdges,
  };
}

/**
 * Computed for the current focused view
 */
export const focusedView = devtoolsContext.computed(() => {
  const nodeId = selectedNodeId();
  return nodeId ? getFocusedView(nodeId) : null;
});

/**
 * Clear all graph state (used on navigation)
 */
export function clearGraph(): void {
  graphState(createEmptyGraphState());
  selectedNodeId(null);
}

/**
 * Get statistics about the graph
 */
export function getGraphStats(): {
  nodeCount: number;
  edgeCount: number;
} {
  const state = graphState();
  return {
    nodeCount: state.nodes.size,
    edgeCount: state.edges.size,
  };
}
