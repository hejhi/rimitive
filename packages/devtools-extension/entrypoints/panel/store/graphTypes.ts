import type { SourceLocation } from './types';

/**
 * Node type in the dependency graph
 */
export type GraphNodeType = 'signal' | 'computed' | 'effect' | 'subscribe';

/**
 * Node in the dependency graph
 */
export type GraphNode = {
  id: string;
  type: GraphNodeType;
  name?: string;
  contextId: string;
  sourceLocation?: SourceLocation;
  created: number;
};

/**
 * Edge in the dependency graph: consumer depends on producer
 */
export type GraphEdge = {
  id: string; // Unique edge identifier: `${consumerId}->${producerId}`
  producerId: string; // Node being read from
  consumerId: string; // Node doing the reading
  tracked: number; // Timestamp when edge was created
};

/**
 * Normalized graph state
 */
export type GraphState = {
  // All nodes by ID
  nodes: Map<string, GraphNode>;

  // All edges by ID
  edges: Map<string, GraphEdge>;

  // Forward adjacency: nodeId -> Set of producer IDs it depends on
  dependencies: Map<string, Set<string>>;

  // Reverse adjacency: nodeId -> Set of consumer IDs that depend on it
  dependents: Map<string, Set<string>>;
};

/**
 * Focused view centered on a node
 */
export type FocusedGraphView = {
  center: GraphNode;
  dependencies: GraphNode[]; // Nodes that center depends on
  dependents: GraphNode[]; // Nodes that depend on center
  dependencyEdges: GraphEdge[]; // Edges from center to its dependencies
  dependentEdges: GraphEdge[]; // Edges from dependents to center
};
