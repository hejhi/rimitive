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
   * Schedules a consumer for batch execution using ring buffer
   */
  function scheduleConsumer(consumer: ScheduledNode): void {
    // Check if already scheduled using a flag to avoid array search
    if (consumer._nextScheduled !== undefined) return;
    
    // Mark as scheduled (use any non-undefined value as flag)
    consumer._nextScheduled = consumer;
    
    // Use ring buffer with bit masking for fast modulo
    ctx.scheduledQueue[ctx.scheduledTail & ctx.scheduledMask] = consumer;
    ctx.scheduledTail++;
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
   * Executes all scheduled consumers using ring buffer
   */
  function flushScheduled(): void {
    const queue = ctx.scheduledQueue;
    const mask = ctx.scheduledMask;
    
    // Calculate number of items to process
    const count = ctx.scheduledTail - ctx.scheduledHead;
    
    // Process in reverse order (LIFO) to achieve FIFO effect execution
    // since dependencies are prepended to the linked list
    for (let i = count - 1; i >= 0; i--) {
      const consumer = queue[(ctx.scheduledHead + i) & mask]!;
      // Clear scheduled flag
      consumer._nextScheduled = undefined;
      consumer._flush();
    }
    
    // Reset the queue
    ctx.scheduledHead = ctx.scheduledTail;
  }

  return {
    scheduleConsumer,
    invalidateConsumer,
    disposeConsumer,
    flushScheduled
  };
}