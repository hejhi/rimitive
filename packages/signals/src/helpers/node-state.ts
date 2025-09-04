import type { DerivedNode } from '../types';
import { CONSTANTS } from '../constants';

const { STATUS_RECOMPUTING, HAS_CHANGED, MASK_STATUS } = CONSTANTS;

export interface NodeState {
  recomputeNode: (node: DerivedNode, flags: number) => boolean;
}

export function createNodeState(): NodeState {
  const recomputeNode = (node: DerivedNode, flags: number): boolean => {
    const changed = node.recompute();
    node.flags = (flags & ~MASK_STATUS) | STATUS_RECOMPUTING;
    if (changed) node.flags = (node.flags & ~MASK_STATUS) | HAS_CHANGED;
    else node.flags = node.flags & ~MASK_STATUS;
    return changed;
  };

  return { recomputeNode };
}