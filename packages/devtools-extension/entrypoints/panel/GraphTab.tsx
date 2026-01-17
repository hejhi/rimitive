import { useState, type MouseEvent } from 'react';
import { useSubscribe } from '@rimitive/react';
import type { GraphNode, FocusedGraphView, GraphNodeType } from './store/graphTypes';
import type { SourceLocation } from './store/types';
import { focusedView, selectedNodeId, graphState } from './store/graphState';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';

/**
 * Node type colors - industrial palette with clear distinctions
 */
const NODE_COLORS: Record<GraphNodeType, { bg: string; border: string; text: string; glow: string }> = {
  signal: {
    bg: 'bg-blue-950/80',
    border: 'border-blue-500',
    text: 'text-blue-300',
    glow: 'shadow-blue-500/20',
  },
  computed: {
    bg: 'bg-violet-950/80',
    border: 'border-violet-500',
    text: 'text-violet-300',
    glow: 'shadow-violet-500/20',
  },
  effect: {
    bg: 'bg-emerald-950/80',
    border: 'border-emerald-500',
    text: 'text-emerald-300',
    glow: 'shadow-emerald-500/20',
  },
  subscribe: {
    bg: 'bg-amber-950/80',
    border: 'border-amber-500',
    text: 'text-amber-300',
    glow: 'shadow-amber-500/20',
  },
};

const EDGE_COLORS = {
  dependency: 'stroke-blue-400/60',
  dependent: 'stroke-emerald-400/60',
};

export function GraphTab() {
  const view = useSubscribe(focusedView);
  const state = useSubscribe(graphState);

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
              Click a node name in the logs tab or select from the list below.
            </span>
          </div>
          <NodeSelector />
        </div>
      </div>
    );
  }

  return <FocusedGraph view={view} />;
}

/**
 * Check if a node is internal (no source location = framework internals)
 */
function isInternalNode(node: GraphNode): boolean {
  return !node.sourceLocation;
}

/**
 * Quick node selector when nothing is focused
 */
function NodeSelector() {
  const state = useSubscribe(graphState);
  const [expanded, setExpanded] = useState(false);
  const [hideInternal, setHideInternal] = useState(true);

  const allNodes = Array.from(state.nodes.values());
  const filteredNodes = hideInternal
    ? allNodes.filter((n) => !isInternalNode(n))
    : allNodes;
  const internalCount = allNodes.length - filteredNodes.length;

  const visibleNodes = expanded ? filteredNodes : filteredNodes.slice(0, 12);
  const hiddenCount = filteredNodes.length - 12;

  if (allNodes.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-3 mt-4">
      {/* Filter toggle */}
      {internalCount > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={hideInternal}
            onChange={(e) => setHideInternal(e.target.checked)}
            className="rounded border-muted-foreground/50"
          />
          Hide internal ({internalCount})
        </label>
      )}

      {/* Node buttons */}
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {visibleNodes.map((node) => (
          <button
            key={node.id}
            onClick={() => selectedNodeId(node.id)}
            className={`
              px-2 py-1 text-xs font-mono rounded border
              ${NODE_COLORS[node.type].bg}
              ${NODE_COLORS[node.type].border}
              ${NODE_COLORS[node.type].text}
              hover:brightness-125 transition-all
            `}
          >
            {node.name ?? node.id.slice(0, 8)}
          </button>
        ))}
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground self-center transition-colors"
          >
            {expanded ? 'Show less' : `+${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The focused graph visualization
 */
function FocusedGraph({ view }: { view: FocusedGraphView }) {
  const { center, dependencies, dependents } = view;

  return (
    <div className="h-full flex flex-col">
      {/* Header showing context */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Focused on:</span>
          <span className={`font-mono font-medium ${NODE_COLORS[center.type].text}`}>
            {center.name ?? center.id}
          </span>
          <span className={`
            px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium
            ${NODE_COLORS[center.type].bg} ${NODE_COLORS[center.type].border} border
          `}>
            {center.type}
          </span>
        </div>
        <button
          onClick={() => selectedNodeId(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear focus
        </button>
      </div>

      {/* Graph visualization */}
      <div className="flex-1 relative overflow-hidden">
        <GraphVisualization view={view} />
      </div>

      {/* Stats footer */}
      <div className="flex items-center justify-center gap-6 px-4 py-2 border-t border-border/50 bg-muted/30 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" />
          {dependencies.length} {dependencies.length === 1 ? 'dependency' : 'dependencies'}
        </span>
        <span className="flex items-center gap-1">
          {dependents.length} {dependents.length === 1 ? 'dependent' : 'dependents'}
          <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

/**
 * SVG-based graph visualization with arc layout
 */
function GraphVisualization({ view }: { view: FocusedGraphView }) {
  const { center, dependencies, dependents } = view;

  // Layout constants
  const centerX = 50; // percentage
  const centerY = 50;
  const arcRadius = 35; // percentage from center
  const nodeWidth = 140;
  const nodeHeight = 36;

  // Calculate positions for dependencies (left arc)
  const depPositions = dependencies.map((_, i) => {
    const total = dependencies.length;
    const angle = total === 1 ? Math.PI : Math.PI / 2 + (i / Math.max(1, total - 1)) * Math.PI;
    return {
      x: centerX + Math.cos(angle) * arcRadius,
      y: centerY + Math.sin(angle) * (arcRadius * 0.8),
    };
  });

  // Calculate positions for dependents (right arc)
  const dependentPositions = dependents.map((_, i) => {
    const total = dependents.length;
    const angle = total === 1 ? 0 : -Math.PI / 2 + (i / Math.max(1, total - 1)) * Math.PI;
    return {
      x: centerX + Math.cos(angle) * arcRadius,
      y: centerY + Math.sin(angle) * (arcRadius * 0.8),
    };
  });

  return (
    <div className="absolute inset-0">
      {/* SVG for edges - viewBox makes percentage coordinates work */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="arrowhead-dep"
            markerWidth="3"
            markerHeight="2"
            refX="2.5"
            refY="1"
            orient="auto"
          >
            <polygon points="0 0, 3 1, 0 2" className="fill-blue-400/60" />
          </marker>
          <marker
            id="arrowhead-dependent"
            markerWidth="3"
            markerHeight="2"
            refX="2.5"
            refY="1"
            orient="auto"
          >
            <polygon points="0 0, 3 1, 0 2" className="fill-emerald-400/60" />
          </marker>
        </defs>

        {/* Dependency edges (from center to dependencies - center depends ON these) */}
        {depPositions.map((pos, i) => (
          <Edge
            key={`dep-${dependencies[i].id}`}
            from={{ x: centerX, y: centerY }}
            to={pos}
            type="dependency"
          />
        ))}

        {/* Dependent edges (from dependents to center - these depend ON center) */}
        {dependentPositions.map((pos, i) => (
          <Edge
            key={`dependent-${dependents[i].id}`}
            from={pos}
            to={{ x: centerX, y: centerY }}
            type="dependent"
          />
        ))}
      </svg>

      {/* Dependency nodes (left side) */}
      {dependencies.map((node, i) => (
        <GraphNodeComponent
          key={node.id}
          node={node}
          position={depPositions[i]}
          nodeWidth={nodeWidth}
          nodeHeight={nodeHeight}
        />
      ))}

      {/* Dependent nodes (right side) */}
      {dependents.map((node, i) => (
        <GraphNodeComponent
          key={node.id}
          node={node}
          position={dependentPositions[i]}
          nodeWidth={nodeWidth}
          nodeHeight={nodeHeight}
        />
      ))}

      {/* Center node - larger and more prominent */}
      <GraphNodeComponent
        key={center.id}
        node={center}
        position={{ x: centerX, y: centerY }}
        nodeWidth={nodeWidth * 1.2}
        nodeHeight={nodeHeight * 1.3}
        isCenter
      />

      {/* Column labels */}
      <div className="absolute left-[15%] top-4 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
        Dependencies
      </div>
      <div className="absolute right-[15%] top-4 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
        Dependents
      </div>
    </div>
  );
}

/**
 * Individual graph node
 */
function GraphNodeComponent({
  node,
  position,
  nodeWidth,
  nodeHeight,
  isCenter = false,
}: {
  node: GraphNode;
  position: { x: number; y: number };
  nodeWidth: number;
  nodeHeight: number;
  isCenter?: boolean;
}) {
  const colors = NODE_COLORS[node.type];
  const displayName = node.name ?? node.id.slice(0, 12);

  const handleClick = (e: MouseEvent) => {
    // Cmd/Ctrl+Click: navigate to that node (same pattern as LogsTab filter)
    if (e.metaKey || e.ctrlKey) {
      if (!isCenter) {
        selectedNodeId(node.id);
      }
      return;
    }

    // Regular click: open in editor (same pattern as LogsTab)
    if (node.sourceLocation) {
      openInEditor(node.sourceLocation);
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        left: `calc(${position.x}% - ${nodeWidth / 2}px)`,
        top: `calc(${position.y}% - ${nodeHeight / 2}px)`,
        width: nodeWidth,
        height: nodeHeight,
      }}
      className={`
        absolute flex flex-col items-center justify-center
        rounded border backdrop-blur-sm
        ${colors.bg} ${colors.border}
        ${isCenter ? `shadow-lg ${colors.glow} border-2` : 'hover:brightness-125'}
        transition-all duration-200 cursor-pointer group
      `}
      title={buildNodeTitle(node, isCenter)}
    >
      <span
        className={`
          text-xs font-mono font-medium truncate max-w-[90%]
          ${colors.text} ${isCenter ? 'text-sm' : ''}
        `}
      >
        {displayName}
      </span>
      <span
        className={`
          text-[9px] uppercase tracking-wider opacity-60 mt-0.5
          ${isCenter ? 'text-[10px]' : ''}
        `}
      >
        {node.type}
      </span>
    </button>
  );
}

/**
 * SVG edge with curved path
 */
function Edge({
  from,
  to,
  type,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  type: 'dependency' | 'dependent';
}) {
  // Calculate control point for bezier curve
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Use quadratic bezier: from -> control point -> to
  const d = `M ${from.x} ${from.y} Q ${midX} ${from.y}, ${midX} ${midY} T ${to.x} ${to.y}`;

  return (
    <path
      d={d}
      fill="none"
      strokeWidth="0.5"
      className={EDGE_COLORS[type]}
      markerEnd={`url(#arrowhead-${type})`}
    />
  );
}

/**
 * Build tooltip title for a node
 */
function buildNodeTitle(node: GraphNode, isCenter: boolean): string {
  const parts: string[] = [];

  if (node.name) {
    parts.push(node.name);
  }
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

/**
 * Open source file in Chrome DevTools
 */
function openInEditor(location: SourceLocation) {
  chrome.devtools.panels.openResource(
    location.filePath,
    location.line - 1,
    location.column ?? 0,
    () => {}
  );
}
