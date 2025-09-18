/**
 * Unified Scheduler - Combines propagation and scheduling for optimal performance
 *
 * 1. Propagates updates through dependency graph
 * 2. Schedules effects/subscriptions for execution
 * 3. Manages batching and flushing automatically
 * 4. Reduces indirection and complexity
 */

import type { Dependency, ScheduledNode, ConsumerNode } from '../types';
import { CONSTANTS } from '../constants';

// Re-export types for proper type inference
export type { Dependency, ScheduledNode, ConsumerNode } from '../types';

const { STATUS_PENDING, STATUS_DISPOSED, STATUS_SCHEDULED, STATUS_CLEAN } = CONSTANTS;

export interface Scheduler {
  /** Propagate updates from a producer to all its dependents */
  propagate: (subscribers: Dependency) => void;
  /** Dispose a scheduled node */
  dispose: <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ) => void;
  /** Start a batch (increment batch depth) */
  startBatch: () => number;
  /** End a batch and auto-flush if needed */
  endBatch: () => number;
  /** Manual flush - rarely needed */
  flush: () => void;
}

export function createScheduler({
  propagate,
}: {
  propagate: (
    subscribers: Dependency,
    onLeaf: (node: ConsumerNode) => void
  ) => void;
}): Scheduler {
  let batchDepth = 0;
  let queueHead: ScheduledNode | undefined;
  let queueTail: ScheduledNode | undefined;

  // Execute all scheduled nodes in FIFO order
  const flush = (): void => {
    // Don't flush during batch - batching will handle it
    if (batchDepth > 0) return;

    let current = queueHead;

    if (!current) return;

    // Clear queue first to allow re-entrance scheduling
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

  // Leaf handler that queues scheduled nodes
  const queueIfScheduled = (node: ConsumerNode): void => {
    // Only queue nodes with flush methods that are pending
    if ('flush' in node && node.status === STATUS_PENDING) {
      node.status = STATUS_SCHEDULED;
      const scheduledNode = node as ScheduledNode;
      scheduledNode.nextScheduled = undefined;

      // Add to execution queue
      if (queueTail) {
        queueTail.nextScheduled = scheduledNode;
        queueTail = scheduledNode;
      } else {
        queueHead = scheduledNode;
        queueTail = scheduledNode;
      }
    }
  };

  // Propagate composes traversal with scheduling
  const scheduledPropagate = (subscribers: Dependency): void => {
    propagate(subscribers, queueIfScheduled);
    flush();
  };

  const startBatch = (): number => batchDepth++;

  const endBatch = (): number => {
    if (batchDepth > 0) {
      batchDepth--;
      if (batchDepth === 0) flush();
    }

    return batchDepth;
  };

  // Idempotent disposal helper
  const dispose = <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ): void => {
    if (node.status === STATUS_DISPOSED) return;
    node.status = STATUS_DISPOSED;
    cleanup(node);
  };

  return {
    propagate: scheduledPropagate,
    dispose,
    startBatch,
    endBatch,
    flush,
  };
}