import { CONSTANTS, createFlagManager } from '../constants';
import type { ScheduledNode, ToNode } from '../types';
import type { GlobalContext } from '../context';

const {
  STATUS_DISPOSED,
  IS_SCHEDULED,
  MASK_STATUS_PROCESSING,
  MASK_STATUS_AWAITING,
  STATUS_DIRTY,
  STATUS_INVALIDATED,
  STATUS_CLEAN,
  STATUS_RECOMPUTING,
} = CONSTANTS;

export interface NodeScheduler {
  enqueue: (node: ScheduledNode) => void;
  dispose: <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ) => void;
  flush: () => void;
}

const { hasAnyOf, setStatus, getStatus, addProperty, removeProperty } = createFlagManager();

/**
 * ALGORITHM: Intrusive FIFO Scheduling Queue
 *
 * Uses each node's `nextScheduled` field as the linked-list pointer.
 * - Enqueue: append to tail of queue in O(1)
 * - Flush: dequeue from head (FIFO) clearing `nextScheduled` before executing
 * - Dedup: any non-undefined `nextScheduled` means "already scheduled"
 *
 * Benefits vs circular buffer:
 * - No fixed capacity or overflow checks
 * - Lower memory and fewer branches
 * - Preserves effect ordering for predictable behavior
 */
export function createNodeScheduler(
  ctx: GlobalContext,
  pullUpdates: (node: ToNode) => void
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
      const nextFlags = removeProperty(current.flags, IS_SCHEDULED);
      const status = getStatus(nextFlags);

      current.nextScheduled = undefined;
      current.flags = nextFlags;

      if (
        status !== STATUS_DISPOSED &&
        !hasAnyOf(nextFlags, MASK_STATUS_PROCESSING) &&
        hasAnyOf(nextFlags, MASK_STATUS_AWAITING)
      ) {
        if (status !== STATUS_DIRTY) {
          // Use checkStale to update dependencies and determine if a scheduled node should run
          pullUpdates(current);

          const newFlags = current.flags;

          // If still INVALIDATED after checkStale, dependencies didn't change
          if (getStatus(newFlags) === STATUS_INVALIDATED) {
            current.flags = setStatus(newFlags, STATUS_CLEAN);
            continue;
          }
        }

        // Transition to recomputing state
        current.flags = setStatus(nextFlags, STATUS_RECOMPUTING);
        current.flush();
      }

      current = next;
    }
  };

  return { enqueue, dispose, flush };
}
