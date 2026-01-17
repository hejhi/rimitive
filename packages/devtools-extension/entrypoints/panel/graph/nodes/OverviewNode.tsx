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
  const { node, metrics, isHovered, onNavigate, onHover } = data;
  const colors = NODE_COLORS[node.type];

  // Scale size based on connection count (8-16px)
  const baseSize = 8;
  const maxSize = 16;
  const size = Math.min(baseSize + metrics.connectionCount, maxSize);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(node.id);
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer transition-all"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colors.border,
        boxShadow: metrics.isOrphaned
          ? `0 0 8px ${ORPHAN_COLOR}, 0 0 12px ${ORPHAN_COLOR}`
          : isHovered
            ? `0 0 12px ${colors.border}`
            : undefined,
        border: metrics.isOrphaned ? `2px solid ${ORPHAN_COLOR}` : undefined,
      }}
      title={`${node.name ?? node.id} (${node.type})`}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }}
      />
    </div>
  );
}
