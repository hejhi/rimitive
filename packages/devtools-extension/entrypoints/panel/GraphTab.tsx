import { useCallback, useEffect, useState, useMemo } from 'react';
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
import type { GraphState, FocusedGraphView, GraphNode, GraphEdge, ViewMode } from './store/graphTypes';
import { useDevtools } from './store/DevtoolsProvider';
import { Layers, Grid3X3, Focus } from 'lucide-react';
import { NODE_COLORS } from './graph/styles';
import { FullGraphView } from './graph/FullGraphView';

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
 * Custom node component for React Flow
 */
function GraphNodeComponent({ data }: { data: GraphNodeData }) {
  const { node, isCenter } = data;
  const colors = NODE_COLORS[node.type];

  return (
    <div
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
    const position = g.node(node.id) as Dagre.Node;
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
function focusedViewToFlow(view: FocusedGraphView, hideInternal: boolean): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Filter function for internal nodes
  const shouldInclude = (node: GraphNode) => !hideInternal || node.sourceLocation;

  // Add dependency nodes (filtered)
  view.dependencies.filter(shouldInclude).forEach((dep) => {
    nodes.push({
      id: dep.id,
      type: 'graphNode',
      position: { x: 0, y: 0 },
      data: { node: dep, isCenter: false },
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
    data: { node: view.center, isCenter: true },
  });

  // Add dependent nodes (filtered)
  view.dependents.filter(shouldInclude).forEach((dep) => {
    nodes.push({
      id: dep.id,
      type: 'graphNode',
      position: { x: 0, y: 0 },
      data: { node: dep, isCenter: false },
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

/**
 * Compute focused view from graph state and selected node
 */
function getFocusedViewFromState(state: GraphState, nodeId: string): FocusedGraphView | null {
  const center = state.nodes.get(nodeId);
  if (!center) return null;

  const depIds = state.dependencies.get(nodeId) ?? new Set();
  const dependencies = Array.from(depIds)
    .map((id) => state.nodes.get(id))
    .filter((node): node is GraphNode => node !== undefined);

  const dependentIds = state.dependents.get(nodeId) ?? new Set();
  const dependents = Array.from(dependentIds)
    .map((id) => state.nodes.get(id))
    .filter((node): node is GraphNode => node !== undefined);

  const dependencyEdges = Array.from(depIds)
    .map((producerId) => state.edges.get(`${nodeId}->${producerId}`))
    .filter((edge): edge is GraphEdge => edge !== undefined);

  const dependentEdges = Array.from(dependentIds)
    .map((consumerId) => state.edges.get(`${consumerId}->${nodeId}`))
    .filter((edge): edge is GraphEdge => edge !== undefined);

  return { center, dependencies, dependents, dependencyEdges, dependentEdges };
}

type GraphTabProps = {
  /** Optional graph state. If not provided, uses global state. */
  graphState?: GraphState;
  /** Whether to hide internal nodes. Defaults to global filter setting. */
  hideInternal?: boolean;
  /** Selected context for filtering. Defaults to global selected context. */
  selectedContext?: string | null;
};

export function GraphTab({ graphState: propGraphState, hideInternal: propHideInternal, selectedContext: propSelectedContext }: GraphTabProps = {}) {
  const devtools = useDevtools();

  // Use provided state or fall back to global
  const globalState = useSubscribe(devtools.graphState);
  const globalFilter = useSubscribe(devtools.filter);
  const globalView = useSubscribe(devtools.focusedView);
  const globalMode = useSubscribe(devtools.viewMode);
  const globalSelectedContext = useSubscribe(devtools.selectedContext);

  // Determine if we're in "controlled" mode (props provided)
  const isControlled = propGraphState !== undefined;

  // Use prop values or global values
  const state = propGraphState ?? globalState;
  const hideInternal = propHideInternal ?? globalFilter.hideInternal;
  const selectedContext = propSelectedContext !== undefined ? propSelectedContext : globalSelectedContext;

  // Filter nodes by context and hideInternal
  const filteredNodes = useMemo(() => {
    return Array.from(state.nodes.values()).filter((node) => {
      if (selectedContext && node.contextId !== selectedContext) return false;
      if (hideInternal && !node.sourceLocation) return false;
      return true;
    });
  }, [state.nodes, selectedContext, hideInternal]);

  // Local state for controlled mode
  const [localSelectedNodeId, setLocalSelectedNodeId] = useState<string | null>(null);
  const [localViewMode, setLocalViewMode] = useState<ViewMode>('full');

  // Always call useSubscribe (hooks must be called unconditionally)
  const subscribedSelectedNodeId = useSubscribe(devtools.selectedNodeId);

  // Get the effective values based on mode
  const effectiveSelectedNodeId = isControlled ? localSelectedNodeId : subscribedSelectedNodeId;
  const effectiveViewMode = isControlled ? localViewMode : globalMode;

  // Compute focused view
  const view = useMemo(() => {
    if (!effectiveSelectedNodeId) return null;
    return getFocusedViewFromState(state, effectiveSelectedNodeId);
  }, [state, effectiveSelectedNodeId]);

  // Use global view for non-controlled mode
  const effectiveView = isControlled ? view : globalView;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const handleSelectNode = useCallback((nodeId: string | null) => {
    if (isControlled) {
      setLocalSelectedNodeId(nodeId);
    } else {
      devtools.selectedNodeId(nodeId);
    }
  }, [isControlled, devtools]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (isControlled) {
      setLocalViewMode(mode);
      if (mode === 'full') setLocalSelectedNodeId(null);
    } else {
      devtools.viewMode(mode);
      // Don't clear selection when switching to full - preserve it for edge highlighting
    }
  }, [isControlled, devtools]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const data = node.data as GraphNodeData;
    if (data.isCenter) return;
    handleSelectNode(node.id);
  }, [handleSelectNode]);

  // Update nodes/edges when view changes (for focused mode)
  useEffect(() => {
    if (effectiveView && effectiveViewMode === 'focused') {
      const { nodes: layoutedNodes, edges: layoutedEdges } = focusedViewToFlow(effectiveView, hideInternal);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } else if (effectiveViewMode === 'focused') {
      setNodes([]);
      setEdges([]);
    }
  }, [effectiveView, effectiveViewMode, hideInternal, setNodes, setEdges]);

  // Empty state
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

  // View mode toggle
  const ViewModeToggle = () => (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md border border-border/50 overflow-hidden">
        <button
          onClick={() => handleViewModeChange('full')}
          className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
            effectiveViewMode === 'full'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
          title="Full graph view"
        >
          <Grid3X3 className="w-3 h-3" />
          Full
        </button>
        <button
          onClick={() => handleViewModeChange('focused')}
          className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors border-l border-border/50 ${
            effectiveViewMode === 'focused'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
          title="Focused view"
        >
          <Focus className="w-3 h-3" />
          Focused
        </button>
      </div>
    </div>
  );

  // Node selector for focused mode
  const NodeSelector = () => {
    const [expanded, setExpanded] = useState(false);
    const displayNodes = expanded ? filteredNodes : filteredNodes.slice(0, 12);
    const hiddenCount = filteredNodes.length - 12;

    if (filteredNodes.length === 0) return null;

    return (
      <div className="flex flex-col items-center gap-4 mt-4">
        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {displayNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => {
                handleSelectNode(node.id);
                handleViewModeChange('focused');
              }}
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
  };

  // Full view mode
  if (effectiveViewMode === 'full') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Grid3X3 className="w-4 h-4" />
            <span>Full Graph</span>
            <span className="text-muted-foreground/60">
              ({filteredNodes.length} nodes)
            </span>
          </div>
          <ViewModeToggle />
        </div>
        <div className="flex-1">
          <FullGraphView graphState={state} hideInternal={hideInternal} selectedContext={selectedContext} onSelectNode={handleSelectNode} />
        </div>
      </div>
    );
  }

  // Focused view mode without selection
  if (!effectiveView) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Focus className="w-4 h-4" />
            <span>Focused View</span>
          </div>
          <ViewModeToggle />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="min-h-full flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Layers className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <div className="text-muted-foreground text-sm">
                Select a node to view its dependencies.
                <br />
                <span className="text-xs text-muted-foreground/60">
                  Click a node in Full view or ⌘+Click a node name in the logs tab.
                </span>
              </div>
              <NodeSelector />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Focused view mode with selection
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Focused on:</span>
          <span className="font-mono font-medium" style={{ color: NODE_COLORS[effectiveView.center.type].text }}>
            {effectiveView.center.name ?? effectiveView.center.id}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium"
            style={{
              background: NODE_COLORS[effectiveView.center.type].bg,
              border: `1px solid ${NODE_COLORS[effectiveView.center.type].border}`,
              color: NODE_COLORS[effectiveView.center.type].text,
            }}
          >
            {effectiveView.center.type}
          </span>
        </div>
        <ViewModeToggle />
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.5, maxZoom: 0.8 }}
          minZoom={0.2}
          maxZoom={2}
          zoomOnPinch
          panOnDrag
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          className="react-flow-dark"
        >
          <Background color="#333" gap={20} />
          <Controls showInteractive={false} className="react-flow-controls-dark" />
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

      <div className="flex items-center justify-center gap-6 px-4 py-2 border-t border-border/50 bg-muted/30 text-xs text-muted-foreground">
        <span>← {effectiveView.dependencies.length} dependencies</span>
        <span>{effectiveView.dependents.length} dependents →</span>
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
