import { CONSTANTS, STATUS_CLEAN } from '../constants';
import type { ScheduledNode } from '../types';

const { STATUS_DISPOSED, STATUS_SCHEDULED } = CONSTANTS;

export interface NodeScheduler {
  enqueue: (node: ScheduledNode) => boolean;
  dispose: <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ) => void;
  flush: () => void;
  startBatch: () => void;
  endBatch: () => void; // Exits batch and auto-flushes if needed
  isInBatch: () => boolean;
}

export function createNodeScheduler(): NodeScheduler {
  let batchDepth = 0;
  let queueHead: ScheduledNode | undefined;
  let queueTail: ScheduledNode | undefined;

  const startBatch = () => batchDepth++;
  const endBatch = () => {
    // Defensive: endBatch called without matching startBatch
    if (!batchDepth) return;
    batchDepth--;
    if (!batchDepth) flush();
  }

  // Enqueue node at tail for FIFO ordering if not already scheduled
  const enqueue = (node: ScheduledNode): boolean => {
    // If already scheduled or disposed, don't enqueue
    if (node.status >= STATUS_SCHEDULED) return false;

    // Hot path - mark as scheduled
    node.status = STATUS_SCHEDULED;
    node.nextScheduled = undefined;

    // Add to queue
    if (queueTail) queueTail.nextScheduled = node;
    else queueHead = node;

    queueTail = node;

    // Return true to indicate enqueued successfully
    // The caller (signal) will handle flushing
    return true;
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

      if (next) current.nextScheduled = undefined;

      if (current.status === STATUS_SCHEDULED) {
        current.status = STATUS_CLEAN;
        current.flush();
      }

      current = next;
    }
  };

  const isInBatch = () => batchDepth > 0;

  return {
    enqueue,
    dispose,
    flush,
    startBatch,
    endBatch,
    isInBatch,
  };
}
