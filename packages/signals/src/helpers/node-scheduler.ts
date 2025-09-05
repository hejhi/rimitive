import { CONSTANTS, createFlagManager } from '../constants';
import type { ScheduledNode } from '../types';
import type { GlobalContext } from '../context';

const { STATUS_DISPOSED, IS_SCHEDULED, MASK_STATUS } = CONSTANTS;

export interface NodeScheduler {
  enqueue: (node: ScheduledNode) => void;
  dispose: <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ) => void;
  flush: () => void;
}

const { hasAnyOf, setStatus, getStatus, addProperty } = createFlagManager();

export function createNodeScheduler(
  ctx: GlobalContext,
): NodeScheduler {
  // Enqueue node at tail for FIFO ordering if not already scheduled
  const enqueue = (node: ScheduledNode): void => {
    // Cache flags for better branch prediction
    const flags = node.flags;
    if (hasAnyOf(flags, IS_SCHEDULED)) return; // Cold path - already scheduled

    // Hot path - add scheduled property with cached flags
    node.flags = addProperty(flags, IS_SCHEDULED);
    node.nextScheduled = undefined;

    // Add to queue
    if (ctx.queueTail) ctx.queueTail.nextScheduled = node;
    else ctx.queueHead = node;

    ctx.queueTail = node;
  };

  // Idempotent disposal helper shared across node types
  const dispose = <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ): void => {
    if (getStatus(node.flags) === STATUS_DISPOSED) return;
    node.flags = setStatus(node.flags, STATUS_DISPOSED);
    cleanup(node);
  };

  // Dequeue all scheduled nodes in FIFO order and execute
  const flush = (): void => {
    let current = ctx.queueHead;
    if (!current) return;

    // Clear the queue first to allow re-entrance scheduling
    ctx.queueHead = ctx.queueTail = undefined;

    while (current) {
      const next: ScheduledNode | undefined = current.nextScheduled;
      const status = current.flags & MASK_STATUS & ~IS_SCHEDULED;

      current.nextScheduled = undefined;
      current.flags = status;

      if (status !== STATUS_DISPOSED && status) current.flush();

      current = next;
    }
  };

  return { enqueue, dispose, flush };
}
