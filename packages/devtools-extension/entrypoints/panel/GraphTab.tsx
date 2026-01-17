import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { useSubscribe } from '@rimitive/react';
import type { GraphNode, FocusedGraphView, GraphNodeType } from './store/graphTypes';
import type { SourceLocation } from './store/types';
import { focusedView, selectedNodeId, graphState } from './store/graphState';
import { devtoolsState } from './store/devtoolsCtx';
import { Layers } from 'lucide-react';

import '@xyflow/react/dist/style.css';

// Dark mode styles for React Flow controls
const darkModeStyles = `
  .react-flow-controls-dark button {
    background: #1a1a1a !important;
    border: 1px solid #333 !important;
    color: #999 !important;
  }
  .react-flow-controls-dark button:hover {
    background: #2a2a2a !important;
    color: #fff !important;
  }
  .react-flow-controls-dark button svg {
    fill: currentColor !important;
  }
  .react-flow-controls-dark {
    box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
  }
`;

// Inject styles once
if (typeof document !== 'undefined') {
  const styleId = 'react-flow-dark-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = darkModeStyles;
    document.head.appendChild(style);
  }
}

/**
 * Node type colors
 */
const NODE_COLORS: Record<GraphNodeType, { bg: string; border: string; text: string }> = {
  signal: { bg: '#172554', border: '#3b82f6', text: '#93c5fd' },
  computed: { bg: '#2e1065', border: '#8b5cf6', text: '#c4b5fd' },
  effect: { bg: '#022c22', border: '#10b981', text: '#6ee7b7' },
  subscribe: { bg: '#451a03', border: '#f59e0b', text: '#fcd34d' },
};

/**
 * Custom node component for React Flow
 */
function GraphNodeComponent({ data }: { data: GraphNodeData }) {
  const { node, isCenter, onNavigate, onOpenSource } = data;
  const colors = NODE_COLORS[node.type];

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (!isCenter) onNavigate(node.id);
    } else if (node.sourceLocation) {
      onOpenSource(node.sourceLocation);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer transition-all hover:brightness-125"
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 8,
        padding: '8px 16px',
        minWidth: 120,
        textAlign: 'center',
        boxShadow: isCenter ? `0 0 20px ${colors.border}40` : undefined,
      }}
      title={buildNodeTitle(node, isCenter)}
    >
      <Handle type="target" position={Position.Left} style={{ background: colors.border }} />
      <div
        style={{
          color: colors.text,
          fontSize: 12,
          fontFamily: 'monospace',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 140,
        }}
      >
        {node.name ?? node.id.slice(0, 12)}
      </div>
      <div
        style={{
          color: colors.text,
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          opacity: 0.7,
          marginTop: 2,
        }}
      >
        {node.type}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: colors.border }} />
    </div>
  );
}

type GraphNodeData = {
  node: GraphNode;
  isCenter: boolean;
  onNavigate: (nodeId: string) => void;
  onOpenSource: (location: SourceLocation) => void;
};

const nodeTypes: NodeTypes = {
  graphNode: GraphNodeComponent,
};

/**
 * Use dagre to compute layout positions
 */
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 100,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 150, height: 50 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const position = g.node(node.id);
    return {
      ...node,
      position: { x: position.x - 75, y: position.y - 25 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Convert focused view to React Flow nodes and edges
 */
function focusedViewToFlow(
  view: FocusedGraphView,
  onNavigate: (nodeId: string) => void,
  onOpenSource: (location: SourceLocation) => void
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Add dependency nodes
  view.dependencies.forEach((dep) => {
    nodes.push({
      id: dep.id,
      type: 'graphNode',
      position: { x: 0, y: 0 },
      data: { node: dep, isCenter: false, onNavigate, onOpenSource },
    });

    // Edge from dependency to center (dependency flows into center)
    edges.push({
      id: `${dep.id}->${view.center.id}`,
      source: dep.id,
      target: view.center.id,
      animated: false,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
    });
  });

  // Add center node
  nodes.push({
    id: view.center.id,
    type: 'graphNode',
    position: { x: 0, y: 0 },
    data: { node: view.center, isCenter: true, onNavigate, onOpenSource },
  });

  // Add dependent nodes
  view.dependents.forEach((dep) => {
    nodes.push({
      id: dep.id,
      type: 'graphNode',
      position: { x: 0, y: 0 },
      data: { node: dep, isCenter: false, onNavigate, onOpenSource },
    });

    // Edge from center to dependent (center flows into dependent)
    edges.push({
      id: `${view.center.id}->${dep.id}`,
      source: view.center.id,
      target: dep.id,
      animated: false,
      style: { stroke: '#10b981', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    });
  });

  return getLayoutedElements(nodes, edges, 'LR');
}

export function GraphTab() {
  const view = useSubscribe(focusedView);
  const state = useSubscribe(graphState);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onNavigate = useCallback((nodeId: string) => {
    selectedNodeId(nodeId);
  }, []);

  const onOpenSource = useCallback((location: SourceLocation) => {
    chrome.devtools.panels.openResource(location.filePath, location.line - 1, location.column ?? 0, () => {});
  }, []);

  // Update nodes/edges when view changes
  useEffect(() => {
    if (view) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = focusedViewToFlow(view, onNavigate, onOpenSource);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [view, onNavigate, onOpenSource, setNodes, setEdges]);

  if (state.nodes.size === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Layers className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <div className="text-muted-foreground text-sm">
            No reactive nodes tracked yet.
            <br />
            <span className="text-xs text-muted-foreground/60">
              Interact with your application to build the dependency graph.
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <Layers className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <div className="text-muted-foreground text-sm">
            Select a node to view its dependencies.
            <br />
            <span className="text-xs text-muted-foreground/60">
              ⌘+Click a node name in the logs tab to focus it.
            </span>
          </div>
          <NodeSelector />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Focused on:</span>
          <span className="font-mono font-medium" style={{ color: NODE_COLORS[view.center.type].text }}>
            {view.center.name ?? view.center.id}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium"
            style={{
              background: NODE_COLORS[view.center.type].bg,
              border: `1px solid ${NODE_COLORS[view.center.type].border}`,
              color: NODE_COLORS[view.center.type].text,
            }}
          >
            {view.center.type}
          </span>
        </div>
        <button
          onClick={() => selectedNodeId(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear focus
        </button>
      </div>

      {/* React Flow */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.5, maxZoom: 0.8 }}
          minZoom={0.2}
          maxZoom={2}
          zoomOnPinch
          panOnDrag
          proOptions={{ hideAttribution: true }}
          className="react-flow-dark"
        >
          <Background color="#333" gap={20} />
          <Controls
            showInteractive={false}
            className="react-flow-controls-dark"
          />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as GraphNodeData;
              return NODE_COLORS[data.node.type].border;
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
            style={{ background: '#1a1a1a' }}
          />
        </ReactFlow>
      </div>

      {/* Stats footer */}
      <div className="flex items-center justify-center gap-6 px-4 py-2 border-t border-border/50 bg-muted/30 text-xs text-muted-foreground">
        <span>← {view.dependencies.length} dependencies</span>
        <span>{view.dependents.length} dependents →</span>
      </div>
    </div>
  );
}

/**
 * Quick node selector when nothing is focused
 */
function NodeSelector() {
  const state = useSubscribe(graphState);
  const filter = useSubscribe(devtoolsState.filter);
  const [expanded, setExpanded] = useState(false);

  // Filter internal nodes (those without sourceLocation)
  const allNodes = Array.from(state.nodes.values()).filter(
    (node) => !filter.hideInternal || node.sourceLocation
  );
  const nodes = expanded ? allNodes : allNodes.slice(0, 12);
  const hiddenCount = allNodes.length - 12;

  if (allNodes.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-4 mt-4">
      {/* Hide Internal toggle */}
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={filter.hideInternal}
          onChange={(e) =>
            devtoolsState.filter({ ...filter, hideInternal: e.target.checked })
          }
          className="rounded border-muted-foreground/50"
        />
        Hide internal
      </label>

      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {nodes.map((node) => (
          <button
            key={node.id}
            onClick={() => selectedNodeId(node.id)}
            className="px-2 py-1 text-xs font-mono rounded border hover:brightness-125 transition-all"
            style={{
              background: NODE_COLORS[node.type].bg,
              borderColor: NODE_COLORS[node.type].border,
              color: NODE_COLORS[node.type].text,
            }}
          >
            {node.name ?? node.id.slice(0, 8)}
          </button>
        ))}
        {hiddenCount > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground self-center transition-colors"
          >
            +{hiddenCount} more
          </button>
        )}
        {expanded && hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-muted-foreground hover:text-foreground self-center transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Build tooltip title for a node
 */
function buildNodeTitle(node: GraphNode, isCenter: boolean): string {
  const parts: string[] = [];

  if (node.name) parts.push(node.name);
  parts.push(`ID: ${node.id}`);
  parts.push(`Type: ${node.type}`);

  if (node.sourceLocation) {
    parts.push('');
    parts.push('Click to open in editor');
  }

  if (!isCenter) {
    parts.push('⌘+Click to focus');
  }

  return parts.join('\n');
}
