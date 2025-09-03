import type { Edge } from '../types';
import { CONSTANTS } from '../constants';
import { createNodeState } from './node-state';

const { STATUS_INVALIDATED, MASK_STATUS_SKIP_NODE } = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface PushPropagator {
  pushUpdates: (from: Edge) => void;
}

const { hasAnyOf, setStatus } = createNodeState();

export function createPushPropagator(): PushPropagator {
  // Iterative DFS on push with an explicit stack, but optimized with intrusive linked lists
  const pushUpdates = (out: Edge): void => {
    let edgeStack: Stack<Edge> | undefined;
    let currentEdge: Edge | undefined = out;

    do {
      const consumerNode = currentEdge.to;
      const consumerNodeFlags = consumerNode.flags;

      if (
        hasAnyOf(consumerNodeFlags, MASK_STATUS_SKIP_NODE | STATUS_INVALIDATED)
      ) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      consumerNode.flags = setStatus(consumerNodeFlags, STATUS_INVALIDATED);

      // Fast path: if node has _notify, it's an effect - schedule it directly
      // This avoids method calls and property lookups
      if ('notify' in consumerNode) consumerNode.notify(consumerNode);

      // `out` is a different direction than an Edge's `to`
      if ('out' in consumerNode) {
        const consumerOutEdge = consumerNode.out;

        // If a consumer has an out, we'll keep traversing it
        if (consumerOutEdge) {
          // Before we do though, we need to save our progress on the stack to revisit later
          // (ie, our current signal's next dependency to propagate to, or this consumers sibling)
          const nextSibling = currentEdge.nextOut;
          if (nextSibling) edgeStack = { value: nextSibling, prev: edgeStack };

          currentEdge = consumerOutEdge;
          continue;
        }
      }

      // No further outs, shift to sibling consumer and go deep
      currentEdge = currentEdge.nextOut;

      if (currentEdge || !edgeStack) continue;

      // No more siblings or dependencies, rinse and repeat with the stack
      while (!currentEdge && edgeStack) {
        currentEdge = edgeStack.value;
        edgeStack = edgeStack.prev; // "Pop" off the stack, working backwards via `prev`
      }
    } while (currentEdge);
  };

  return { pushUpdates };
}