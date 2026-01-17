import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { GraphState, GraphNode, NodeMetrics } from '../store/graphTypes';
import type { SourceLocation } from '../store/types';
import { NODE_COLORS } from './styles';

// Layout constants
const COLUMN_WIDTH = 250;
const NODE_HEIGHT = 50;
const NODE_SPACING = 10;
const COLUMN_PADDING = 30;

// Column assignments by node type
const TYPE_COLUMNS: Record<GraphNode['type'], number> = {
  signal: 0,
  computed: 1,
  effect: 2,
  subscribe: 2,
};

export type StratifiedNodeData = {
  node: GraphNode;
  metrics: NodeMetrics;
  isHovered: boolean;
  onNavigate: (nodeId: string) => void;
  onOpenSource: (location: SourceLocation) => void;
  onHover: (nodeId: string | null) => void;
};

/**
 * Group nodes by source file for vertical ordering within columns
 */
function groupBySourceFile(nodes: GraphNode[]): Map<string, GraphNode[]> {
  const groups = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const key = node.sourceLocation?.filePath ?? '__no_source__';
    const group = groups.get(key);
    if (group) {
      group.push(node);
    } else {
      groups.set(key, [node]);
    }
  }

  return groups;
}

/**
 * Compute stratified column layout for all nodes
 */
export function computeStratifiedLayout(
  state: GraphState,
  metrics: Map<string, NodeMetrics>,
  hoveredNodeId: string | null,
  onNavigate: (nodeId: string) => void,
  onOpenSource: (location: SourceLocation) => void,
  onHover: (nodeId: string | null) => void,
  hideInternal: boolean
): { nodes: Node<StratifiedNodeData>[]; edges: Edge[] } {
  const resultNodes: Node<StratifiedNodeData>[] = [];
  const resultEdges: Edge[] = [];

  // Filter and organize nodes by column
  const columns: GraphNode[][] = [[], [], []];
  for (const node of state.nodes.values()) {
    // Skip internal nodes if hideInternal is true
    if (hideInternal && !node.sourceLocation) continue;

    const column = TYPE_COLUMNS[node.type];
    columns[column].push(node);
  }

  // Compute positions for each column
  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    const columnNodes = columns[colIndex];

    // Group by source file for visual organization
    const groups = groupBySourceFile(columnNodes);

    let yOffset = COLUMN_PADDING;
    for (const [, groupNodes] of groups) {
      // Sort nodes within group by creation time
      groupNodes.sort((a, b) => a.created - b.created);

      for (const node of groupNodes) {
        const nodeMetrics = metrics.get(node.id) ?? { connectionCount: 0, isOrphaned: false };

        resultNodes.push({
          id: node.id,
          type: 'stratifiedNode',
          position: {
            x: colIndex * COLUMN_WIDTH + COLUMN_PADDING,
            y: yOffset,
          },
          data: {
            node,
            metrics: nodeMetrics,
            isHovered: hoveredNodeId === node.id,
            onNavigate,
            onOpenSource,
            onHover,
          },
        });

        yOffset += NODE_HEIGHT + NODE_SPACING;
      }

      // Add extra spacing between groups
      yOffset += NODE_SPACING;
    }
  }

  // Build edge set for quick lookup
  const nodeIdSet = new Set(resultNodes.map((n) => n.id));

  // Compute connected edges for hovered node
  const hoveredConnectedEdges = new Set<string>();
  if (hoveredNodeId) {
    const deps = state.dependencies.get(hoveredNodeId);
    const dependents = state.dependents.get(hoveredNodeId);

    if (deps) {
      for (const depId of deps) {
        hoveredConnectedEdges.add(`${hoveredNodeId}->${depId}`);
      }
    }
    if (dependents) {
      for (const depId of dependents) {
        hoveredConnectedEdges.add(`${depId}->${hoveredNodeId}`);
      }
    }
  }

  // Create edges
  for (const edge of state.edges.values()) {
    // Skip edges where either node is filtered out
    if (!nodeIdSet.has(edge.producerId) || !nodeIdSet.has(edge.consumerId)) {
      continue;
    }

    const edgeId = `${edge.consumerId}->${edge.producerId}`;
    const isHighlighted = hoveredConnectedEdges.has(edge.id);

    // Get source node type for edge color
    const sourceNode = state.nodes.get(edge.producerId);
    const edgeColor = sourceNode ? NODE_COLORS[sourceNode.type].border : '#666';

    resultEdges.push({
      id: edgeId,
      source: edge.producerId,
      target: edge.consumerId,
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
