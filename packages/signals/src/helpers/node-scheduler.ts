import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';

const { STATUS_DISPOSED } = CONSTANTS;

export interface NodeScheduler {
  enqueue: (node: ScheduledNode) => void;
  dispose: <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ) => void;
  flush: () => void;
  enterBatch: () => void;
  inBatch: () => boolean;
  exitBatch: () => void;
}

export function createNodeScheduler(): NodeScheduler {
  let batchDepth = 0;
  let queueHead: ScheduledNode | undefined;
  let queueTail: ScheduledNode | undefined;

  const enterBatch = () => batchDepth++;
  const inBatch = () => !!batchDepth;
  const exitBatch = () => { batchDepth--; };

  // Enqueue node at tail for FIFO ordering if not already scheduled
  const enqueue = (node: ScheduledNode): void => {
    // Fast path - check if already scheduled
    if (node.isScheduled) return; // Cold path - already scheduled

    // Hot path - mark as scheduled
    node.isScheduled = true;
    node.nextScheduled = undefined;

    // Add to queue
    if (queueTail) queueTail.nextScheduled = node;
    else queueHead = node;

    queueTail = node;
  };

  // Idempotent disposal helper shared across node types
  const dispose = <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ): void => {
    // Fast disposal check
    if (node.status === STATUS_DISPOSED) return;
    node.status = STATUS_DISPOSED;
    cleanup(node);
  };

  // Dequeue all scheduled nodes in FIFO order and execute
  const flush = (): void => {
    let current = queueHead;
    if (!current) return;

    // Clear the queue first to allow re-entrance scheduling
    queueHead = queueTail = undefined;

    while (current) {
      const next: ScheduledNode | undefined = current.nextScheduled;
      current.nextScheduled = undefined;

      // Clear scheduled flag
      current.isScheduled = false;

      // Only flush if not disposed
      if (current.status !== STATUS_DISPOSED) {
        current.flush(current);
      }

      current = next;
    }
  };

  return {
    enqueue,
    dispose,
    flush,
    enterBatch,
    inBatch,
    exitBatch,
  };
}
