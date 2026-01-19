import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import { useSubscribe } from '@rimitive/react';
import { useDevtools } from '../store/DevtoolsProvider';
import type { GraphState } from '../store/graphTypes';
import type { SourceLocation } from '../store/types';
import {
  computeStratifiedLayout,
  type StratifiedNodeData,
} from './stratifiedLayout';
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
  const devtools = useDevtools();

  // Use provided state or fall back to global
  const globalState = useSubscribe(devtools.graphState);
  const globalFilter = useSubscribe(devtools.filter);
  const globalSelectedContext = useSubscribe(devtools.selectedContext);
  const metrics = useSubscribe(devtools.nodeMetrics);
  const hovered = useSubscribe(devtools.hoveredNodeId);

  const state = propGraphState ?? globalState;
  const hideInternal = propHideInternal ?? globalFilter.hideInternal;
  const selectedContext =
    propSelectedContext !== undefined
      ? propSelectedContext
      : globalSelectedContext;

  const [nodes, setNodes, onNodesChange] = useNodesState<
    Node<StratifiedNodeData>
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Use global selection so it persists across view mode toggles
  const selected = useSubscribe(devtools.selectedNodeId);

  // Single click: select node, or open source if already selected
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<StratifiedNodeData>) => {
      if (selected === node.id) {
        // Already selected - open source if available
        const sourceLocation = node.data.node.sourceLocation;
        if (sourceLocation) {
          chrome.devtools.panels.openResource(
            sourceLocation.filePath,
            sourceLocation.line - 1,
            sourceLocation.column ?? 0,
            () => {}
          );
        }
      } else {
        // Select the node
        devtools.selectedNodeId(node.id);
        if (onSelectNode) {
          onSelectNode(node.id);
        }
      }
    },
    [onSelectNode, selected, devtools]
  );

  const onOpenSource = useCallback((location: SourceLocation) => {
    chrome.devtools.panels.openResource(
      location.filePath,
      location.line - 1,
      location.column ?? 0,
      () => {}
    );
  }, []);

  const onHover = useCallback((nodeId: string | null) => {
    devtools.hoveredNodeId(nodeId);
  }, [devtools]);

  // No-op for onNavigate since clicks are handled at ReactFlow level
  const noopNavigate = useCallback(() => {}, []);

  // Compute layout when state, metrics, hover, selection, or context changes
  const layoutResult = useMemo(() => {
    return computeStratifiedLayout(
      state,
      metrics,
      hovered,
      selected,
      noopNavigate,
      onOpenSource,
      onHover,
      hideInternal,
      selectedContext
    );
  }, [
    state,
    metrics,
    hovered,
    selected,
    noopNavigate,
    onOpenSource,
    onHover,
    hideInternal,
    selectedContext,
  ]);

  // Update nodes/edges when layout changes
  useEffect(() => {
    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
  }, [layoutResult, setNodes, setEdges]);

  // Track if we should center on selected node (on mount)
  const shouldCenterOnMount = useRef(!!selected);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView={!shouldCenterOnMount.current}
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
      <CenterOnSelected
        selectedNodeId={selected}
        shouldCenter={shouldCenterOnMount.current}
      />
      <Background color="#333" gap={20} />
      <Controls showInteractive={false} className="react-flow-controls-dark" />
      <MiniMap
        nodeColor={(node) => {
          const data = node.data as StratifiedNodeData;
          return NODE_COLORS[data.node.type].border;
        }}
        maskColor="rgba(0, 0, 0, 0.8)"
        style={{ background: '#1a1a1a' }}
        pannable
        zoomable
      />
    </ReactFlow>
  );
}

/**
 * Helper component to center on selected node when mounting.
 * Must be inside ReactFlow to use useReactFlow hook.
 */
function CenterOnSelected({
  selectedNodeId,
  shouldCenter,
}: {
  selectedNodeId: string | null;
  shouldCenter: boolean;
}) {
  const { fitView } = useReactFlow();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (shouldCenter && selectedNodeId && !hasCentered.current) {
      // Small delay to ensure nodes are rendered
      const timer = setTimeout(() => {
        void fitView({
          nodes: [{ id: selectedNodeId }],
          padding: 1.5,
          maxZoom: 0.8,
          duration: 200,
        });
        hasCentered.current = true;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedNodeId, shouldCenter, fitView]);

  return null;
}
