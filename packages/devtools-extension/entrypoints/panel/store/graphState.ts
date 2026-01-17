import { devtoolsContext } from './devtoolsCtx';
import type { GraphState, FocusedGraphView, GraphNode, GraphEdge } from './graphTypes';

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
 * Updated atomically from graph:snapshot events
 */
export const graphState = devtoolsContext.signal<GraphState>(
  createEmptyGraphState()
);

/**
 * Selected node ID for focused view
 */
export const selectedNodeId = devtoolsContext.signal<string | null>(null);

/**
 * Get a focused view of the graph centered on a node
 */
function getFocusedView(nodeId: string): FocusedGraphView | null {
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
 * Clear all graph state
 */
export function clearGraph(): void {
  graphState(createEmptyGraphState());
  selectedNodeId(null);
}
