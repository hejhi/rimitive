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

const { STATUS_PENDING, STATUS_DISPOSED, STATUS_SCHEDULED, STATUS_CLEAN, STATUS_DIRTY } = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
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

export function createScheduler(): Scheduler {
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


  // Pure graph traversal that marks nodes and notifies about leaves
  const traverseGraph = (
    subscribers: Dependency,
    onLeaf: (node: ConsumerNode) => void
  ): void => {
    let dependencyStack: Stack<Dependency> | undefined;
    let currentDependency: Dependency | undefined = subscribers;

    do {
      const consumerNode = currentDependency.consumer;
      const consumerNodeStatus = consumerNode.status;

      // Skip already processed nodes
      if (consumerNodeStatus !== STATUS_CLEAN && consumerNodeStatus !== STATUS_DIRTY) {
        currentDependency = currentDependency.nextConsumer;
        continue;
      }

      // Mark as pending (invalidated)
      consumerNode.status = STATUS_PENDING;

      // Check if we can traverse deeper
      const hasSubscribers = 'subscribers' in consumerNode && consumerNode.subscribers;

      if (!hasSubscribers) {
        // This is a leaf node - notify the callback
        onLeaf(consumerNode);

        currentDependency = currentDependency.nextConsumer;
        if (!currentDependency && dependencyStack) {
          currentDependency = dependencyStack.value;
          dependencyStack = dependencyStack.prev;
        }
        continue;
      }

      // Continue traversal
      const consumerSubscribers = consumerNode.subscribers!;
      const siblingDep = currentDependency.nextConsumer;

      if (siblingDep) {
        dependencyStack = { value: siblingDep, prev: dependencyStack };
      }

      currentDependency = consumerSubscribers;
    } while (currentDependency);
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

  // Public propagate composes traversal with scheduling
  const propagate = (subscribers: Dependency): void => {
    traverseGraph(subscribers, queueIfScheduled);
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
    propagate,
    dispose,
    startBatch,
    endBatch,
    flush
  };
}