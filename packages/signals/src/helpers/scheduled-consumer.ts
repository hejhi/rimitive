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
   * Schedules a consumer for batch execution
   */
  function scheduleConsumer(consumer: ScheduledNode): void {
    // Avoid scheduling the same consumer multiple times
    if (consumer._nextScheduled !== undefined) return;
    
    consumer._nextScheduled = ctx.scheduled === null ? undefined : ctx.scheduled;
    ctx.scheduled = consumer;
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
    if (!(consumer._flags & DISPOSED)) {
      consumer._flags |= DISPOSED;
      cleanupFn(consumer);
    }
  }

  /**
   * Executes all scheduled consumers in the queue
   */
  function flushScheduled(): void {
    let scheduled = ctx.scheduled;
    ctx.scheduled = null;

    while (scheduled) {
      const current = scheduled;
      scheduled = scheduled._nextScheduled || null;
      current._flush();
    }
  }

  return {
    scheduleConsumer,
    invalidateConsumer,
    disposeConsumer,
    flushScheduled
  };
}