import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { StratifiedNodeData } from '../stratifiedLayout';
import { NODE_COLORS, ORPHAN_COLOR } from '../styles';

/**
 * Overview node - small colored dot for zoomed-out view
 * Size scales with connectionCount (8-16px)
 * Yellow glow for orphaned nodes
 */
export function OverviewNode({ data }: { data: StratifiedNodeData }): React.ReactElement {
  const { node, metrics, isHovered, isSelected, onHover } = data;
  const colors = NODE_COLORS[node.type];

  // Scale size based on connection count (12-24px)
  const baseSize = 12;
  const maxSize = 24;
  const size = Math.min(baseSize + metrics.connectionCount * 2, maxSize);

  const getBoxShadow = () => {
    if (metrics.isOrphaned) return `0 0 8px ${ORPHAN_COLOR}, 0 0 12px ${ORPHAN_COLOR}`;
    if (isSelected) return `0 0 12px ${colors.border}, 0 0 20px ${colors.border}`;
    if (isHovered) return `0 0 12px ${colors.border}`;
    return undefined;
  };

  return (
    <div
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer transition-all"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colors.border,
        boxShadow: getBoxShadow(),
        border: metrics.isOrphaned ? `2px solid ${ORPHAN_COLOR}` : undefined,
      }}
      title={`${node.name ?? node.id} (${node.type})`}
    >
      {/* Vertical handles for bottom-to-top flow */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }}
      />
      <Handle
        id="bottom"
        type="target"
        position={Position.Bottom}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }}
      />
    </div>
  );
}
