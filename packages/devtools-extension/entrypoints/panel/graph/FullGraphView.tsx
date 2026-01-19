import React, { useCallback, useEffect, useMemo } from 'react';
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
} from '@xyflow/react';
import { useSubscribe } from '@rimitive/react';
import {
  graphState as globalGraphState,
  selectedNodeId as globalSelectedNodeId,
  hoveredNodeId,
  nodeMetrics,
  viewMode as globalViewMode,
} from '../store/graphState';
import { devtoolsState } from '../store/devtoolsCtx';
import type { GraphState } from '../store/graphTypes';
import type { SourceLocation } from '../store/types';
import { computeStratifiedLayout, type StratifiedNodeData } from './stratifiedLayout';
import { StratifiedNode } from './nodes/StratifiedNode';
import { NODE_COLORS } from './styles';

const nodeTypes: NodeTypes = {
  stratifiedNode: StratifiedNode,
};

type FullGraphViewProps = {
  /** Optional graph state. If not provided, uses global state. */
  graphState?: GraphState;
  /** Whether to hide internal nodes. Defaults to global filter setting. */
  hideInternal?: boolean;
  /** Selected context ID for filtering. Defaults to global selected context. */
  selectedContext?: string | null;
  /** Callback when a node is selected. Defaults to updating global state. */
  onSelectNode?: (nodeId: string | null) => void;
};

export function FullGraphView({
  graphState: propGraphState,
  hideInternal: propHideInternal,
  selectedContext: propSelectedContext,
  onSelectNode,
}: FullGraphViewProps = {}): React.ReactElement {
  // Use provided state or fall back to global
  const globalState = useSubscribe(globalGraphState);
  const globalFilter = useSubscribe(devtoolsState.filter);
  const globalSelectedContext = useSubscribe(devtoolsState.selectedContext);
  const metrics = useSubscribe(nodeMetrics);
  const hovered = useSubscribe(hoveredNodeId);

  const state = propGraphState ?? globalState;
  const hideInternal = propHideInternal ?? globalFilter.hideInternal;
  const selectedContext = propSelectedContext !== undefined ? propSelectedContext : globalSelectedContext;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StratifiedNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<StratifiedNodeData>) => {
    if (onSelectNode) {
      onSelectNode(node.id);
    } else {
      globalSelectedNodeId(node.id);
      globalViewMode('focused');
    }
  }, [onSelectNode]);

  const onOpenSource = useCallback((location: SourceLocation) => {
    chrome.devtools.panels.openResource(location.filePath, location.line - 1, location.column ?? 0, () => {});
  }, []);

  const onHover = useCallback((nodeId: string | null) => {
    hoveredNodeId(nodeId);
  }, []);

  // No-op for onNavigate since clicks are handled at ReactFlow level
  const noopNavigate = useCallback(() => {}, []);

  // Compute layout when state, metrics, hover, or context changes
  const layoutResult = useMemo(() => {
    return computeStratifiedLayout(
      state,
      metrics,
      hovered,
      noopNavigate,
      onOpenSource,
      onHover,
      hideInternal,
      selectedContext
    );
  }, [state, metrics, hovered, noopNavigate, onOpenSource, onHover, hideInternal, selectedContext]);

  // Update nodes/edges when layout changes
  useEffect(() => {
    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
  }, [layoutResult, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3, minZoom: 0.5, maxZoom: 1 }}
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
          const data = node.data as StratifiedNodeData;
          return NODE_COLORS[data.node.type].border;
        }}
        maskColor="rgba(0, 0, 0, 0.8)"
        style={{ background: '#1a1a1a' }}
      />
    </ReactFlow>
  );
}
