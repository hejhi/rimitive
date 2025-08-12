import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';

const { DISPOSED } = CONSTANTS;

export interface QueueState {
  // Top of the intrusive LIFO stack (scheduled nodes)
  head: ScheduledNode | undefined;
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
 * ALGORITHM: Intrusive LIFO Scheduling Stack
 *
 * Uses each node's `_nextScheduled` field as the linked-list pointer.
 * - Enqueue: push onto a singly-linked stack in O(1)
 * - Flush: pop nodes (LIFO) clearing `_nextScheduled` before executing
 * - Dedup: any non-undefined `_nextScheduled` means "already scheduled"
 *
 * Benefits vs circular buffer:
 * - No fixed capacity or overflow checks
 * - Lower memory and fewer branches
 * - Preserves existing LIFO flush semantics used by tests
 */
export function createWorkQueue(): WorkQueue {
  const state: QueueState = {
    head: undefined,
    size: 0,
  };

  // Push node onto intrusive stack if not already scheduled
  const enqueue = (node: ScheduledNode): void => {
    if (node._nextScheduled !== undefined) return; // already scheduled
    // If stack is empty, use self-reference as a sentinel to mark scheduled
    // Otherwise, link to previous head
    node._nextScheduled = state.head ?? node;
    state.head = node;
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

  // Pop all scheduled nodes in LIFO order and execute
  const flush = (): void => {
    let current = state.head;
    if (!current) return;

    // Clear the stack head first to allow re-entrance scheduling
    state.head = undefined;
    // We'll decrement size as we process; preserve initial count to avoid underflow effects
    while (current) {
      const rawNext: ScheduledNode | undefined = current._nextScheduled;
      const next: ScheduledNode | undefined =
        rawNext === current ? undefined : rawNext;
      current._nextScheduled = undefined; // clear scheduled flag
      // Decrement size safely
      if (state.size > 0) state.size--;
      current._flush();
      current = next;
    }
  };

  return { state, enqueue, dispose, flush };
}
