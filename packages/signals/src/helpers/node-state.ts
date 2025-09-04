import type { DerivedNode } from '../types';
import { CONSTANTS } from '../constants';

const { HAS_CHANGED, MASK_STATUS } = CONSTANTS;

export interface NodeState {
  recomputeNode: (node: DerivedNode, flags: number) => boolean;
}

export function createNodeState(): NodeState {
  const recomputeNode = (node: DerivedNode, _flags: number): boolean => {
    const changed = node.recompute();
    // Simplified: just set HAS_CHANGED if changed, otherwise clear status (CLEAN)
    if (changed) {
      node.flags = (node.flags & ~MASK_STATUS) | HAS_CHANGED;
    } else {
      node.flags = node.flags & ~MASK_STATUS; // Clear status (set to CLEAN)
    }
    return changed;
  };

  return { recomputeNode };
}