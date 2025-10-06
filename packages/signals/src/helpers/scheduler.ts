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
import { createGraphTraversal } from './graph-traversal';

const { PENDING, DIRTY, CLEAN, DISPOSED, STATE_MASK, CONSUMER, SCHEDULED } = CONSTANTS;

// Predefined status combinations for scheduled nodes (effects)
const SCHEDULED_CLEAN = CONSUMER | SCHEDULED | CLEAN;
const SCHEDULED_PENDING = CONSUMER | SCHEDULED | PENDING;
const SCHEDULED_DISPOSED = CONSUMER | SCHEDULED | DISPOSED;

// Re-export types for proper type inference
export type { Dependency, ScheduledNode, ConsumerNode } from '../types';

export interface Scheduler {
  /** Propagate updates through subscriber graph (includes both computeds and effects) */
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
  detachAll,
  traverseGraph: customTraverseGraph,
}: {
  detachAll: (dep: Dependency) => void;
  traverseGraph?: (subscribers: Dependency) => void;
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

        const stateStatus = current.status & STATE_MASK;

        // Only flush if scheduled (skip disposed nodes)
        // IMPORTANT: Check for BOTH PENDING and DIRTY
        // During flush, effects can be upgraded from PENDING to DIRTY by shallowPropagate
        if (stateStatus & (PENDING | DIRTY)) {
          current.status = SCHEDULED_CLEAN;
          try {
            current.flush();
          } catch (e) {
            console.error(
              '[Scheduler] Unhandled error in scheduled effect:',
              e
            );
          }
        }

        current = next;
      } while (current);
    }

    isFlushing = false;
  };

  // Handler that queues scheduled effects from a dependency (filters by SCHEDULED flag)
  const queueIfScheduled = (dep: Dependency): void => {
    // Skip if not a scheduled node (effect)
    if (!(dep.consumer.status & SCHEDULED)) return;

    const scheduled = dep.consumer as ScheduledNode;

    // Skip if not clean (already pending/dirty/disposed)
    if ((scheduled.status & STATE_MASK) !== CLEAN) return;

    scheduled.status = SCHEDULED_PENDING;
    scheduled.nextScheduled = undefined;

    // Add to execution queue
    if (queueTail === undefined) {
      queueHead = queueTail = scheduled;
    } else {
      queueTail.nextScheduled = scheduled;
      queueTail = scheduled;
    }
  };

  // Use custom traverseGraph for testing, or create our own with queueing callback
  const traverseGraph = customTraverseGraph ?? createGraphTraversal(queueIfScheduled).traverseGraph;

  // Propagate through subscribers (both computeds and effects)
  const propagate = (subscribers: Dependency): void => {
    traverseGraph(subscribers);
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
    propagate,
    dispose,
    startBatch,
    endBatch,
    flush,
  };
}