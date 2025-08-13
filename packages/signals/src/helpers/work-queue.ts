import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';
import type { SignalContext } from '../context';

const { DISPOSED } = CONSTANTS;

export interface QueueState {
  // Number of scheduled nodes (for quick checks and observability)
  size: number;
}

export interface WorkQueue {
  state: QueueState;
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
  const state: QueueState = {
    size: 0,
  };

  // Enqueue node at tail for FIFO ordering if not already scheduled
  const enqueue = (node: ScheduledNode): void => {
    if (node._nextScheduled !== undefined) return; // already scheduled
    // Use self-reference as sentinel to mark as scheduled
    node._nextScheduled = node;
    if (ctx.queueTail) {
      ctx.queueTail._nextScheduled = node;
      ctx.queueTail = node;
    } else {
      ctx.queueHead = ctx.queueTail = node;
    }
    state.size++;
  };

  // Idempotent disposal helper shared across node types
  const dispose = <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ): void => {
    if (node._flags & DISPOSED) return;
    node._flags |= DISPOSED;
    cleanup(node);
  };

  // Dequeue all scheduled nodes in FIFO order and execute
  const flush = (): void => {
    let current = ctx.queueHead;
    if (!current) return;

    // Clear the queue first to allow re-entrance scheduling
    ctx.queueHead = ctx.queueTail = undefined;
    state.size = 0;
    
    while (current) {
      const next: ScheduledNode | undefined = current._nextScheduled === current ? undefined : current._nextScheduled;
      current._nextScheduled = undefined; // clear scheduled flag
      current._flush();
      current = next;
    }
  };

  return { state, enqueue, dispose, flush };
}
