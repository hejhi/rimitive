/**
 * Unified Scheduler - Combines propagation and scheduling for optimal performance
 *
 * 1. Propagates updates through dependency graph
 * 2. Schedules effects/subscriptions for execution
 * 3. Manages batching and flushing automatically
 * 4. Reduces indirection and complexity
 */

import type { Dependency, ScheduledNode, ConsumerNode, ToNode } from '../types';
import { CONSTANTS } from '../constants';

// Re-export types for proper type inference
export type { Dependency, ScheduledNode, ConsumerNode } from '../types';

const { CONSUMER_PENDING, SCHEDULED_DISPOSED, SCHEDULED, STATUS_CLEAN } = CONSTANTS;

// Global error handler for scheduler exceptions
let errorHandler: ((error: unknown) => void) | undefined;

/**
 * Sets a custom error handler for all scheduler-related errors.
 * If no handler is set, errors will be logged to the console.
 *
 * @param handler - A function that receives the error.
 */
export function setSchedulerErrorHandler(handler: (error: unknown) => void): void {
  errorHandler = handler;
}

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
  detachAll,
}: {
  propagate: (
    subscribers: Dependency,
    onLeaf: (node: ConsumerNode) => void
  ) => void;
  detachAll: (dep: Dependency) => void;
}): Scheduler {
  let batchDepth = 0;
  let queueHead: ScheduledNode | undefined;
  let queueTail: ScheduledNode | undefined;
  let isFlushing = false;

  // Execute all scheduled nodes in FIFO order
  const flush = (): void => {
    // Don't flush during batch - batching will handle it
    if (batchDepth > 0 || isFlushing) return;

    isFlushing = true;

    // Process queue until empty (handles re-entrance)
    while (queueHead !== undefined) {
      // Take current queue
      let current: ScheduledNode | undefined = queueHead;

      // Clear queue first to allow re-entrance scheduling
      queueHead = queueTail = undefined;

      // Process all nodes in this batch
      do {
        const next: ScheduledNode | undefined = current.nextScheduled;

        if (next !== undefined) current.nextScheduled = undefined;

        // Only flush if scheduled (skip disposed nodes)
        if (current.status === SCHEDULED) {
          current.status = STATUS_CLEAN;
          try {
            current.flush();
          } catch (e) {
            // Report error without breaking the queue
            if (errorHandler) {
              errorHandler(e);
            } else {
              console.error('[Scheduler] Unhandled error in scheduled effect:', e);
            }
          }
        }

        current = next;
      } while (current);
    }

    isFlushing = false;
  };

  // Leaf handler that queues scheduled nodes
  const queueIfScheduled = (node: ToNode): void => {
    if (!('flush' in node)) return;
    if (node.status !== CONSUMER_PENDING) return;

    // Only queue nodes with flush methods that are pending
    node.status = SCHEDULED;
    node.nextScheduled = undefined;

    // Add to execution queue
    if (queueTail !== undefined) {
      queueTail.nextScheduled = node;
      queueTail = node;
    } else {
      queueHead = queueTail = node;
    }
  };

  // Propagate composes traversal with scheduling
  const scheduledPropagate = (subscribers: Dependency): void => {
    propagate(subscribers, queueIfScheduled);

    // Only flush if we must
    if (queueHead === undefined) return;

    flush();
  };

  const startBatch = (): number => batchDepth++;

  const endBatch = (): number => {
    if (batchDepth) {
      batchDepth--;

      if (!batchDepth && queueHead !== undefined) flush();
    }

    return batchDepth;
  };

  // Idempotent disposal helper
  const dispose = <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ): void => {
    if (node.status === SCHEDULED_DISPOSED) return;

    node.status = SCHEDULED_DISPOSED;
    cleanup(node);

    const deps = node.dependencies;

    if (deps !== undefined) {
      detachAll(deps);
      node.dependencies = undefined;
    }

    node.dependencyTail = undefined;
  };

  return {
    propagate: scheduledPropagate,
    dispose,
    startBatch,
    endBatch,
    flush,
  };
}