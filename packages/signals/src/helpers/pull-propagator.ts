import type { ToNode, Edge } from '../types';
import { CONSTANTS } from '../constants';
import { createNodeState } from './node-state';

const {
  STATUS_CLEAN,
  STATUS_DIRTY,
  STATUS_CHECKING,
  STATUS_RECOMPUTING,
  HAS_CHANGED,
  MASK_STATUS_AWAITING,
  MASK_STATUS_PROCESSING,
} = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface PullPropagator {
  pullUpdates: (node: ToNode) => void;
}

const { getStatus, hasAnyOf, resetStatus, setStatus, recomputeNode } = createNodeState();

export function createPullPropagator(): PullPropagator {
  const pullUpdates = (node: ToNode): void => {
    const flags = node._flags;
    const status = getStatus(flags);
    const isDerivedNode = '_recompute' in node;
    
    if (
      status === STATUS_CLEAN ||
      status === STATUS_CHECKING ||
      status === STATUS_RECOMPUTING
    )
      return;
    
    if (status === STATUS_DIRTY) {
      if (isDerivedNode) recomputeNode(node, flags);
      else node._flags = resetStatus(flags);
      return;
    }
    
    node._flags = setStatus(flags, STATUS_CHECKING);

    let stack: Stack<Edge> | undefined;
    let currentNode = node;
    let currentEdge = node._in;
    let stale = false;

    for (;;) {
      while (currentEdge) {
        const source = currentEdge.from;
        const sFlags = source._flags;

        if (hasAnyOf(sFlags, HAS_CHANGED)) {
          stale = true;
          break;
        }

        const nextEdge = currentEdge.nextIn;

        if (!('_recompute' in source)) {
          currentEdge = nextEdge;
          continue;
        }

        if (hasAnyOf(sFlags, MASK_STATUS_AWAITING)) {
          if (hasAnyOf(sFlags, MASK_STATUS_PROCESSING)) {
            currentEdge = nextEdge;
            continue;
          }

          const sourceStatus = getStatus(sFlags);
          
          if (sourceStatus === STATUS_DIRTY) {
            stale = recomputeNode(source, sFlags);

            if (stale) break;

            currentEdge = nextEdge;
            continue;
          }

          source._flags = setStatus(sFlags, STATUS_CHECKING);

          if (nextEdge) {
            if (!stack) stack = { value: nextEdge, prev: undefined };
            else stack = { value: nextEdge, prev: stack };
          }

          currentNode = source;
          currentEdge = source._in;
          continue;
        }

        currentEdge = nextEdge;
      }

      if (currentNode !== node && ('_recompute' in currentNode)) {
        const currentFlags = currentNode._flags;
        const currentState = getStatus(currentFlags);
        
        if (currentState === STATUS_DIRTY || stale) {
          stale = recomputeNode(currentNode, currentFlags);
        } else {
          currentNode._flags = resetStatus(currentFlags);
          stale = false;
        }
      }
      
      if (!stack) break;
      
      currentEdge = stack.value;
      currentNode = currentEdge.to;
      stack = stack.prev;
    }

    const newFlags = node._flags;

    if (stale && isDerivedNode) recomputeNode(node, newFlags);
    else node._flags = resetStatus(newFlags);
  };

  return { pullUpdates };
}