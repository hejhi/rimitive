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

const { STATUS_PENDING, STATUS_DISPOSED, STATUS_SCHEDULED, STATUS_CLEAN, STATUS_DIRTY } = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface Scheduler {
  /** Propagate updates from a producer to all its dependents */
  propagate: (subscribers: Dependency) => void;
  enqueue: (node: ScheduledNode) => void;
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

export function createScheduler(): Scheduler {
  let batchDepth = 0;
  let queueHead: ScheduledNode | undefined;
  let queueTail: ScheduledNode | undefined;

  // Execute all scheduled nodes in FIFO order
  const flush = (): void => {
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

  // Add node to execution queue
  const enqueue = (node: ScheduledNode): void => {
    // If already scheduled or disposed, don't enqueue
    if (node.status >= STATUS_SCHEDULED) return;

    // Mark as scheduled
    node.status = STATUS_SCHEDULED;
    node.nextScheduled = undefined;

    // Add to FIFO queue
    if (queueTail) queueTail.nextScheduled = node;
    else queueHead = node;

    queueTail = node;
  };

  // Single pass through dependency graph that both propagates status
  // and schedules nodes, eliminating redundant traversals
  const propagate = (subscribers: Dependency): void => {
    let dependencyStack: Stack<Dependency> | undefined;
    let currentDependency: Dependency | undefined = subscribers;

    do {
      const consumerNode = currentDependency.consumer;
      const consumerNodeStatus = consumerNode.status;

      // Only process nodes in their natural state (CLEAN or DIRTY)
      // All other states mean the node has already been handled:
      // - STATUS_PENDING: already visited in this propagation
      // - STATUS_SCHEDULED+: already in queue (set by enqueue)
      // - STATUS_DISPOSED: dead node
      if (consumerNodeStatus !== STATUS_CLEAN && consumerNodeStatus !== STATUS_DIRTY) {
        currentDependency = currentDependency.nextConsumer;
        continue;
      }

      // Mark as pending (invalidated)
      consumerNode.status = STATUS_PENDING;

      // Schedule if this is a scheduled node (effect/subscription)
      // enqueue() will upgrade status to STATUS_SCHEDULED
      if ('flush' in consumerNode) {
        enqueue(consumerNode);
        // Don't traverse through scheduled nodes - they'll handle their own updates
        currentDependency = currentDependency.nextConsumer;

        // If no sibling, try to pop from stack
        if (!currentDependency && dependencyStack) {
          currentDependency = dependencyStack.value;
          dependencyStack = dependencyStack.prev;
        }
        continue;
      }

      // Continue propagation for intermediate nodes (computeds)
      if ('subscribers' in consumerNode) {
        const consumerSubscribers = consumerNode.subscribers;

        if (consumerSubscribers) {
          // Save sibling for later processing
          const siblingDep = currentDependency.nextConsumer;

          if (siblingDep) {
            dependencyStack = { value: siblingDep, prev: dependencyStack };
          }

          currentDependency = consumerSubscribers;
          continue;
        }
      }

      // Move to next sibling
      currentDependency = currentDependency.nextConsumer;

      // Pop from stack when no more siblings
      if (!currentDependency && dependencyStack) {
        currentDependency = dependencyStack.value;
        dependencyStack = dependencyStack.prev;
      }
    } while (currentDependency);

    // Auto-flush if not in batch
    if (batchDepth === 0) flush();
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
    propagate,
    dispose,
    startBatch,
    endBatch,
    flush,
    enqueue
  };
}