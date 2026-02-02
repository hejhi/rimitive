import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type { GraphState, GraphNode, NodeMetrics } from '../store/graphTypes';
import type { SourceLocation } from '../store/types';
import { NODE_COLORS } from './styles';

// Layout constants
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const RANK_SEP = 80; // Vertical space between ranks (layers)
const NODE_SEP = 30; // Horizontal space between nodes in same rank

export type StratifiedNodeData = {
  node: GraphNode;
  metrics: NodeMetrics;
  isHovered: boolean;
  isSelected: boolean;
  onNavigate: (nodeId: string) => void;
  onOpenSource: (location: SourceLocation) => void;
  onHover: (nodeId: string | null) => void;
};

/**
 * Compute graph layout using dagre for automatic DAG positioning.
 * Nodes flow bottom-to-top based on dependencies, with color coding by type.
 */
export function computeStratifiedLayout(
  state: GraphState,
  metrics: Map<string, NodeMetrics>,
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
  onNavigate: (nodeId: string) => void,
  onOpenSource: (location: SourceLocation) => void,
  onHover: (nodeId: string | null) => void,
  hideInternal: boolean,
  selectedContext: string | null = null
): { nodes: Node<StratifiedNodeData>[]; edges: Edge[] } {
  const resultNodes: Node<StratifiedNodeData>[] = [];
  const resultEdges: Edge[] = [];

  // Filter nodes
  const filteredNodes: GraphNode[] = [];
  for (const node of state.nodes.values()) {
    // Skip nodes from other contexts if a context is selected
    if (selectedContext && node.contextId !== selectedContext) continue;
    // Skip internal nodes if hideInternal is true
    if (hideInternal && !node.sourceLocation) continue;
    filteredNodes.push(node);
  }

  const nodeIdSet = new Set(filteredNodes.map((n) => n.id));

  // Build filtered edges (only edges between visible nodes)
  const filteredEdges = Array.from(state.edges.values()).filter(
    (edge) => nodeIdSet.has(edge.producerId) && nodeIdSet.has(edge.consumerId)
  );

  // Create dagre graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'BT', // Bottom to top - signals at bottom, effects at top
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to dagre
  for (const node of filteredNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Add edges to dagre (producer -> consumer direction for top-to-bottom flow)
  for (const edge of filteredEdges) {
    g.setEdge(edge.producerId, edge.consumerId);
  }

  // Run dagre layout
  dagre.layout(g);

  // Extract positions and create React Flow nodes
  for (const node of filteredNodes) {
    const nodeWithPosition = g.node(node.id) as dagre.Node;
    const nodeMetrics = metrics.get(node.id) ?? { connectionCount: 0, isOrphaned: false };

    resultNodes.push({
      id: node.id,
      type: 'stratifiedNode',
      position: {
        // Dagre returns center position, adjust to top-left for React Flow
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      data: {
        node,
        metrics: nodeMetrics,
        isHovered: hoveredNodeId === node.id,
        isSelected: selectedNodeId === node.id,
        onNavigate,
        onOpenSource,
        onHover,
      },
    });
  }

  // Compute connected edges for hovered or selected node
  const highlightedEdges = new Set<string>();
  const highlightNodeId = hoveredNodeId ?? selectedNodeId;
  if (highlightNodeId) {
    const deps = state.dependencies.get(highlightNodeId);
    const dependents = state.dependents.get(highlightNodeId);

    if (deps) {
      for (const depId of deps) {
        highlightedEdges.add(`${highlightNodeId}->${depId}`);
      }
    }
    if (dependents) {
      for (const depId of dependents) {
        highlightedEdges.add(`${depId}->${highlightNodeId}`);
      }
    }
  }

  // Create edges with proper styling
  for (const edge of filteredEdges) {
    const edgeId = `${edge.consumerId}->${edge.producerId}`;
    const isHighlighted = highlightedEdges.has(edge.id);

    // Get source node type for edge color
    const sourceNode = state.nodes.get(edge.producerId);
    const edgeColor = sourceNode ? NODE_COLORS[sourceNode.type].border : '#666';

    resultEdges.push({
      id: edgeId,
      source: edge.producerId,
      target: edge.consumerId,
      // Use vertical handles for bottom-to-top flow (producer below, consumer above)
      sourceHandle: 'top',
      targetHandle: 'bottom',
      animated: false,
      style: {
        stroke: edgeColor,
        strokeWidth: isHighlighted ? 2 : 1,
        opacity: isHighlighted ? 1 : 0.15,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
        width: 12,
        height: 12,
      },
    });
  }

  return { nodes: resultNodes, edges: resultEdges };
}
