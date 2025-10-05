/**
 * Unified Scheduler - Combines propagation and scheduling for optimal performance
 *
 * 1. Propagates updates through dependency graph
 * 2. Schedules effects/subscriptions for execution
 * 3. Manages batching and flushing automatically
 * 4. Reduces indirection and complexity
 */

import type { Dependency, ScheduledNode } from '../types';
import { CONSTANTS } from '../constants';

const { PENDING, CLEAN, DISPOSED, STATE_MASK, CONSUMER, SCHEDULED } = CONSTANTS;

// Predefined status combinations for scheduled nodes (effects)
const SCHEDULED_CLEAN = CONSUMER | SCHEDULED | CLEAN;
const SCHEDULED_PENDING = CONSUMER | SCHEDULED | PENDING;
const SCHEDULED_DISPOSED = CONSUMER | SCHEDULED | DISPOSED;

// Re-export types for proper type inference
export type { Dependency, ScheduledNode, ConsumerNode } from '../types';

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
  /** Propagate updates through computed subscribers graph */
  propagateSubscribers: (subscribers: Dependency) => void;
  /** Propagate updates through scheduled effects chain */
  propagateScheduled: (scheduled: Dependency) => void;
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
  traverseGraph,
  detachAll,
}: {
  traverseGraph: (
    subscribers: Dependency,
    schedule: (scheduledDep: Dependency) => void
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
        if ((current.status & STATE_MASK) === PENDING) {
          current.status = SCHEDULED_CLEAN;
          try {
            current.flush();
          } catch (e) {
            // Report error without breaking the queue
            if (errorHandler) {
              errorHandler(e);
            } else {
              console.error(
                '[Scheduler] Unhandled error in scheduled effect:',
                e
              );
            }
          }
        }

        current = next;
      } while (current);
    }

    isFlushing = false;
  };

  // Handler that queues scheduled effects from a dependency chain
  const queueIfScheduled = (scheduledDep: Dependency): void => {
    do {
      // Only Dependencies with ScheduledNode consumers are in the scheduled chain
      const scheduled = scheduledDep.consumer as ScheduledNode;

      if ((scheduled.status & STATE_MASK) !== CLEAN) {
        scheduledDep = scheduledDep.nextConsumer!;
        continue
      }

      scheduled.status = SCHEDULED_PENDING;
      scheduled.nextScheduled = undefined;

      // Add to execution queue
      if (queueTail === undefined) {
        queueHead = queueTail = scheduled;
      } else {
        queueTail.nextScheduled = scheduled;
        queueTail = scheduled;
      }
    } while (scheduledDep);
  };

  // Propagate through computed subscribers with scheduling
  const propagateSubscribers = (subscribers: Dependency): void => {
    traverseGraph(subscribers, queueIfScheduled);
    if (queueHead === undefined) return;
    flush();
  };

  // Propagate through scheduled effects chain
  const propagateScheduled = (scheduled: Dependency): void => {
    queueIfScheduled(scheduled);
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
    if ((node.status & STATE_MASK) === DISPOSED) return;

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
    propagateSubscribers,
    propagateScheduled,
    dispose,
    startBatch,
    endBatch,
    flush,
  };
}