import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';
import type { SignalContext } from '../context';

const { STATUS_DISPOSED, IS_SCHEDULED, STATUS_MASK } = CONSTANTS;

export interface WorkQueue {
  enqueue: (node: ScheduledNode) => void;
  dispose: <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ) => void;
  flush: () => void;
}

/**
 * ALGORITHM: Intrusive FIFO Scheduling Queue
 *
 * Uses each node's `_nextScheduled` field as the linked-list pointer.
 * - Enqueue: append to tail of queue in O(1)
 * - Flush: dequeue from head (FIFO) clearing `_nextScheduled` before executing
 * - Dedup: any non-undefined `_nextScheduled` means "already scheduled"
 *
 * Benefits vs circular buffer:
 * - No fixed capacity or overflow checks
 * - Lower memory and fewer branches
 * - Preserves effect ordering for predictable behavior
 */
export function createWorkQueue(ctx: SignalContext): WorkQueue {

  // Enqueue node at tail for FIFO ordering if not already scheduled
  const enqueue = (node: ScheduledNode): void => {
    // Cache flags for better branch prediction
    const flags = node._flags;
    if (flags & IS_SCHEDULED) return; // Cold path - already scheduled
    
    // Hot path - add scheduled property with cached flags
    node._flags = flags | IS_SCHEDULED;
    node._nextScheduled = undefined;

    // Add to queue
    if (ctx.queueTail) ctx.queueTail._nextScheduled = node;
    else ctx.queueHead = node;

    ctx.queueTail = node;
  };

  // Idempotent disposal helper shared across node types
  const dispose = <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ): void => {
    if ((node._flags & STATUS_MASK) === STATUS_DISPOSED) return;
    node._flags = (node._flags & ~STATUS_MASK) | STATUS_DISPOSED;
    cleanup(node);
  };

  // Dequeue all scheduled nodes in FIFO order and execute
  const flush = (): void => {
    let current = ctx.queueHead;
    if (!current) return;

    // Clear the queue first to allow re-entrance scheduling
    ctx.queueHead = ctx.queueTail = undefined;
    
    while (current) {
      const next: ScheduledNode | undefined = current._nextScheduled;
      current._nextScheduled = undefined;
      current._flags = current._flags & ~IS_SCHEDULED; // Clear scheduled property
      current._flush();
      current = next;
    }
  };

  return { enqueue, dispose, flush };
}
