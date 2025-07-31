import { CONSTANTS } from '../constants';
import type { SignalContext } from '../context';
import type { ScheduledNode, StatefulNode } from '../types';

const { DISPOSED } = CONSTANTS;

export interface ScheduledConsumerHelpers {
  scheduleConsumer: (consumer: ScheduledNode) => void;
  invalidateConsumer: (
    consumer: ScheduledNode & StatefulNode,
    checkFlags: number,
    setFlags: number
  ) => void;
  disposeConsumer: <T extends ScheduledNode & StatefulNode>(
    consumer: T,
    cleanupFn: (consumer: T) => void
  ) => void;
  flushScheduled: () => void;
}

export function createScheduledConsumerHelpers(ctx: SignalContext): ScheduledConsumerHelpers {
  /**
   * Schedules a consumer for batch execution using array queue
   */
  function scheduleConsumer(consumer: ScheduledNode): void {
    // Check if already scheduled using a flag to avoid array search
    if (consumer._nextScheduled !== undefined) return;
    
    // Mark as scheduled (use any non-undefined value as flag)
    consumer._nextScheduled = consumer;
    
    // Direct array assignment is faster than push
    ctx.scheduledQueue[ctx.scheduledCount++] = consumer;
  }

  /**
   * Common invalidation logic for scheduled consumers
   */
  function invalidateConsumer(
    consumer: ScheduledNode & StatefulNode,
    checkFlags: number,
    setFlags: number
  ): void {
    if (consumer._flags & checkFlags) return;
    consumer._flags |= setFlags;

    if (ctx.batchDepth > 0) {
      scheduleConsumer(consumer);
      return;
    }

    consumer._flush();
  }

  /**
   * Common disposal pattern for scheduled consumers
   */
  function disposeConsumer<T extends ScheduledNode & StatefulNode>(
    consumer: T,
    cleanupFn: (consumer: T) => void
  ): void {
    if (consumer._flags & DISPOSED) return;
    consumer._flags |= DISPOSED;
    cleanupFn(consumer);
  }

  /**
   * Executes all scheduled consumers using array iteration
   */
  function flushScheduled(): void {
    const queue = ctx.scheduledQueue;
    const count = ctx.scheduledCount;
    
    // Reset count first to handle re-scheduling during flush
    ctx.scheduledCount = 0;
    
    // Process queue in reverse order to maintain FIFO semantics
    // (last added to array = first created effect = should run first)
    for (let i = count - 1; i >= 0; i--) {
      const consumer = queue[i]!; // Safe: we know count is accurate
      // Clear scheduled flag
      consumer._nextScheduled = undefined;
      consumer._flush();
    }
  }

  return {
    scheduleConsumer,
    invalidateConsumer,
    disposeConsumer,
    flushScheduled
  };
}