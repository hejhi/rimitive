import type { GraphNodeType } from '../store/graphTypes';

/**
 * Node type colors for the graph visualization
 */
export const NODE_COLORS: Record<GraphNodeType, { bg: string; border: string; text: string }> = {
  signal: { bg: '#172554', border: '#3b82f6', text: '#93c5fd' },
  computed: { bg: '#2e1065', border: '#8b5cf6', text: '#c4b5fd' },
  effect: { bg: '#022c22', border: '#10b981', text: '#6ee7b7' },
  subscribe: { bg: '#451a03', border: '#f59e0b', text: '#fcd34d' },
};

/**
 * Orphan indicator color (yellow)
 */
export const ORPHAN_COLOR = '#facc15';
