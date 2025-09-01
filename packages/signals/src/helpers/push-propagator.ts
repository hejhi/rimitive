import type { Edge, ScheduledNode } from '../types';
import { CONSTANTS } from '../constants';
import type { NodeState } from './node-state';

const { STATUS_INVALIDATED, MASK_STATUS_SKIP_NODE } = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface PushPropagator {
  invalidate: (
    from: Edge | undefined,
    visit: (node: ScheduledNode) => void
  ) => void;
}

export function createPushPropagator(
  nodeState: NodeState
): PushPropagator {
  const { hasAnyOf, setStatus } = nodeState;

  const invalidate = (
    from: Edge | undefined,
    visit: (node: ScheduledNode) => void
  ): void => {
    if (!from) return;
    
    let stack: Stack<Edge> | undefined;
    let currentEdge: Edge | undefined = from;
    
    do {
      const target = currentEdge.to;
      const targetFlags = target._flags;

      if (hasAnyOf(targetFlags, MASK_STATUS_SKIP_NODE | STATUS_INVALIDATED)) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      target._flags = setStatus(targetFlags, STATUS_INVALIDATED);

      if ('_out' in target) {
        const firstChild = target._out;

        if (firstChild && target._out) {
          const nextSibling = currentEdge.nextOut;

          if (nextSibling) stack = { value: nextSibling, prev: stack };

          currentEdge = firstChild;
          continue;
        }
      } else if ('_nextScheduled' in target) visit(target);

      currentEdge = currentEdge.nextOut;

      if (currentEdge || !stack) continue;

      while (!currentEdge && stack) {
        currentEdge = stack.value;
        stack = stack.prev;
      }
    } while (currentEdge);
  };

  return { invalidate };
}