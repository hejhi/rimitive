import type { DerivedNode } from '../types';
import { CONSTANTS, createFlagManager } from '../constants';

const { STATUS_RECOMPUTING, HAS_CHANGED } = CONSTANTS;
const { getStatus, hasAnyOf, resetStatus, setStatus } = createFlagManager();

export interface NodeState {
  getStatus: (flags: number) => number;
  hasAnyOf: (flags: number, mask: number) => boolean;
  resetStatus: (flags: number) => number;
  setStatus: (flags: number, status: number) => number;
  recomputeNode: (node: DerivedNode, flags: number) => boolean;
}

export function createNodeState(): NodeState {
  const recomputeNode = (node: DerivedNode, flags: number): boolean => {
    node._flags = setStatus(flags, STATUS_RECOMPUTING);
    const changed = node._recompute();
    if (changed) {
      node._flags = resetStatus(flags) | HAS_CHANGED;
    } else {
      node._flags = resetStatus(flags);
    }
    return changed;
  };

  return {
    getStatus,
    hasAnyOf,
    resetStatus,
    setStatus,
    recomputeNode
  };
}