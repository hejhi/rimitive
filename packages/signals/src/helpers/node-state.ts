import type { DerivedNode } from '../types';
import { CONSTANTS } from '../constants';

const { DIRTY, MASK_STATUS } = CONSTANTS;

export interface NodeState {
  recomputeNode: (node: DerivedNode, flags?: number) => boolean;
}

export function createNodeState(): NodeState {
  const recomputeNode = (node: DerivedNode): boolean => {
    const changed = node.recompute();
    // Set DIRTY property if changed, clear if not changed
    if (changed) {
      node.flags = (node.flags & ~MASK_STATUS) | DIRTY;
    } else {
      // Clear both status AND DIRTY flag when value doesn't change
      node.flags = node.flags & ~(MASK_STATUS | DIRTY);
    }
    return changed;
  };

  return { recomputeNode };
}