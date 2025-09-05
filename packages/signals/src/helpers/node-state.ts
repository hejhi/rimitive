import type { DerivedNode } from '../types';
import { CONSTANTS } from '../constants';

const { DIRTY, MASK_STATUS } = CONSTANTS;

export interface NodeState {
  recomputeNode: (node: DerivedNode, flags?: number) => boolean;
}

export function createNodeState(): NodeState {
  const recomputeNode = (node: DerivedNode): boolean => {
    const changed = node.recompute();
    // Set DIRTY property if changed, always clear status to CLEAN
    if (changed) {
      node.flags = (node.flags & ~MASK_STATUS) | DIRTY;
    } else {
      node.flags = node.flags & ~MASK_STATUS; // Clear status (set to CLEAN)
    }
    return changed;
  };

  return { recomputeNode };
}