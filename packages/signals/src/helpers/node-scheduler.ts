import { CONSTANTS } from '../constants';
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

export function createNodeScheduler(
  ctx: GlobalContext,
): NodeScheduler {
  // Enqueue node at tail for FIFO ordering if not already scheduled
  const enqueue = (node: ScheduledNode): void => {
    // Single flag read and conditional write
    const flags = node.flags;
    if (flags & IS_SCHEDULED) return; // Cold path - already scheduled

    // Hot path - add scheduled flag directly
    node.flags = flags | IS_SCHEDULED;
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
    // Single flag read and conditional write
    if ((node.flags & MASK_STATUS) === STATUS_DISPOSED) return;
    node.flags = STATUS_DISPOSED;
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
      current.nextScheduled = undefined;
      
      // Single flag operation: clear IS_SCHEDULED and check if should flush
      const flags = current.flags & ~IS_SCHEDULED;
      current.flags = flags;
      
      // Only flush if not disposed and has a status
      if ((flags & MASK_STATUS) !== STATUS_DISPOSED && (flags & MASK_STATUS)) {
        current.flush();
      }

      current = next;
    }
  };

  return { enqueue, dispose, flush };
}
