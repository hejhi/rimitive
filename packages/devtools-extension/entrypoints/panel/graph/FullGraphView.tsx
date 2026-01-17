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
import { graphState, selectedNodeId, hoveredNodeId, nodeMetrics, viewMode } from '../store/graphState';
import { devtoolsState } from '../store/devtoolsCtx';
import type { SourceLocation } from '../store/types';
import { computeStratifiedLayout, type StratifiedNodeData } from './stratifiedLayout';
import { StratifiedNode } from './nodes/StratifiedNode';
import { NODE_COLORS } from './styles';

const nodeTypes: NodeTypes = {
  stratifiedNode: StratifiedNode,
};

export function FullGraphView(): React.ReactElement {
  const state = useSubscribe(graphState);
  const metrics = useSubscribe(nodeMetrics);
  const hovered = useSubscribe(hoveredNodeId);
  const filter = useSubscribe(devtoolsState.filter);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StratifiedNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onNavigate = useCallback((nodeId: string) => {
    selectedNodeId(nodeId);
    viewMode('focused');
  }, []);

  const onOpenSource = useCallback((location: SourceLocation) => {
    chrome.devtools.panels.openResource(location.filePath, location.line - 1, location.column ?? 0, () => {});
  }, []);

  const onHover = useCallback((nodeId: string | null) => {
    hoveredNodeId(nodeId);
  }, []);

  // Compute layout when state, metrics, or hover changes
  const layoutResult = useMemo(() => {
    return computeStratifiedLayout(
      state,
      metrics,
      hovered,
      onNavigate,
      onOpenSource,
      onHover,
      filter.hideInternal
    );
  }, [state, metrics, hovered, onNavigate, onOpenSource, onHover, filter.hideInternal]);

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
