import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { StratifiedNodeData } from '../stratifiedLayout';
import { NODE_COLORS, ORPHAN_COLOR } from '../styles';

/**
 * Build tooltip title for a node
 */
function buildNodeTitle(data: StratifiedNodeData): string {
  const { node, metrics } = data;
  const parts: string[] = [];

  if (node.name) parts.push(node.name);
  parts.push(`ID: ${node.id}`);
  parts.push(`Type: ${node.type}`);
  parts.push(`Connections: ${metrics.connectionCount}`);

  if (metrics.isOrphaned) {
    parts.push('');
    parts.push('Warning: Orphaned (no dependents)');
  }

  if (node.sourceLocation) {
    parts.push('');
    parts.push('Click to open in editor');
  }

  parts.push('Click to focus node');

  return parts.join('\n');
}

/**
 * Detail node - full name, type badge
 */
export function DetailNode({ data }: { data: StratifiedNodeData }): React.ReactElement {
  const { node, metrics, isHovered, isSelected, onHover } = data;
  const colors = NODE_COLORS[node.type];

  // Determine visual state priority: orphaned > selected > hovered
  const getBoxShadow = () => {
    if (metrics.isOrphaned) return `0 0 12px ${ORPHAN_COLOR}40`;
    if (isSelected) return `0 0 20px ${colors.border}80, 0 0 30px ${colors.border}40`;
    if (isHovered) return `0 0 20px ${colors.border}40`;
    return undefined;
  };

  // Show underline when selected and has source (hint that click will open source)
  const hasSource = !!node.sourceLocation;
  const showAsLink = isSelected && hasSource;

  return (
    <div
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer transition-all hover:brightness-125"
      style={{
        background: colors.bg,
        border: metrics.isOrphaned
          ? `2px solid ${ORPHAN_COLOR}`
          : isSelected
            ? `3px solid ${colors.border}`
            : `2px solid ${colors.border}`,
        borderRadius: 8,
        padding: '8px 16px',
        minWidth: 120,
        textAlign: 'center',
        boxShadow: getBoxShadow(),
      }}
      title={buildNodeTitle(data)}
    >
      {/* Vertical handles for bottom-to-top flow */}
      <Handle id="top" type="source" position={Position.Top} style={{ background: colors.border }} />
      <Handle id="bottom" type="target" position={Position.Bottom} style={{ background: colors.border }} />
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
          textDecoration: showAsLink ? 'underline' : undefined,
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
    </div>
  );
}
