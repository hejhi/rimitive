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

// ALGORITHM: Effect Scheduling System
// Effects (side effects) need special handling to ensure they run in a consistent state.
// This module implements a high-performance scheduling queue using a circular buffer.
export function createScheduledConsumerHelpers(ctx: SignalContext): ScheduledConsumerHelpers {
  /**
   * ALGORITHM: Circular Buffer Queue for O(1) Scheduling
   * 
   * Instead of using array push/shift (O(n) for shift), we use a circular
   * buffer with head/tail pointers. This provides O(1) enqueue and dequeue.
   * 
   * The buffer size is always a power of 2 (256), allowing us to use bitwise
   * AND instead of modulo for wrapping, which is significantly faster.
   */
  const scheduleConsumer = (consumer: ScheduledNode): void => {
    // OPTIMIZATION: Use _nextScheduled as a boolean flag
    // Instead of searching the queue to check if scheduled, we use the
    // _nextScheduled property as a flag. Any non-undefined value means scheduled.
    if (consumer._nextScheduled !== undefined) return;
    
    // Mark as scheduled - we use self-reference as a sentinel value
    // This is memory-efficient and doesn't require a separate boolean
    consumer._nextScheduled = consumer;
    
    // OPTIMIZATION: Lazy Queue Allocation
    // Don't allocate the 256-element array until we actually need it
    // Many apps might not use effects at all
    if (!ctx.scheduledQueue) {
      ctx.scheduledQueue = new Array<ScheduledNode>(256);
    }
    
    // ALGORITHM: Circular Buffer Insertion
    // Use bitwise AND with mask (255 = 0xFF = 11111111 in binary)
    // This is equivalent to scheduledTail % 256 but much faster
    // Example: 257 & 255 = 1, 513 & 255 = 1 (wraps around)
    ctx.scheduledQueue[ctx.scheduledTail & ctx.scheduledMask] = consumer;
    ctx.scheduledTail++;
    
    // FLAG: Queue will silently wrap if more than 256 effects are scheduled
    // This could overwrite earlier entries. Consider dynamic resizing?
  }

  /**
   * ALGORITHM: Conditional Scheduling Based on Batch State
   * 
   * This provides a unified invalidation pattern that respects batching:
   * - Inside a batch: Schedule for later execution
   * - Outside a batch: Execute immediately
   * 
   * This ensures effects always see a consistent state where all
   * signal updates in a batch have completed.
   */
  const invalidateConsumer = (
    consumer: ScheduledNode & StatefulNode,
    checkFlags: number,  // Flags that indicate "already handled"
    setFlags: number     // Flags to set when handling
  ): void => {
    // OPTIMIZATION: Early exit if already processed
    // Prevents duplicate scheduling/execution
    if (consumer._flags & checkFlags) return;
    
    // Mark with the provided flags (usually NOTIFIED or OUTDATED)
    consumer._flags |= setFlags;

    // ALGORITHM: Batch-Aware Execution
    if (ctx.batchDepth > 0) {
      // Inside a batch - defer execution
      scheduleConsumer(consumer);
      return;
    }

    // Outside batch - execute immediately
    // This happens when effects trigger other effects
    consumer._flush();
  }

  /**
   * ALGORITHM: Safe Disposal Pattern
   * 
   * Ensures consumers are disposed exactly once and marked to prevent
   * further scheduling or execution. The DISPOSED flag acts as a
   * tombstone to skip the node in all future operations.
   */
  const disposeConsumer = <T extends ScheduledNode & StatefulNode>(
    consumer: T,
    cleanupFn: (consumer: T) => void  // Custom cleanup logic per consumer type
  ): void => {
    // OPTIMIZATION: Idempotent disposal
    // Check flag first to avoid redundant cleanup
    if (consumer._flags & DISPOSED) return;
    
    // Mark as disposed before cleanup to prevent re-entrance
    consumer._flags |= DISPOSED;
    
    // Execute consumer-specific cleanup (remove edges, clear references)
    cleanupFn(consumer);
  }

  /**
   * ALGORITHM: Batch Flush with Circular Buffer
   * 
   * Executes all scheduled effects in the order they were invalidated.
   * Uses the circular buffer for efficient dequeue without array shifting.
   * 
   * IMPORTANT: We process in reverse order (LIFO) which actually gives us
   * FIFO execution semantics. This is because the dependency graph traversal
   * prepends new edges, so the last edge added represents the first dependency.
   */
  const flushScheduled = (): void => {
    // Skip if queue hasn't been initialized yet (no effects used)
    if (!ctx.scheduledQueue) return;
    
    const queue = ctx.scheduledQueue;
    const mask = ctx.scheduledMask;
    const head = ctx.scheduledHead;
    
    // Calculate number of items to process
    // Since tail can wrap around, this arithmetic works correctly
    const count = ctx.scheduledTail - head;
    
    // ALGORITHM: Reverse Order Processing for Correct Execution Order
    // Process from tail to head (LIFO) to achieve FIFO effect order
    // This counterintuitive approach is needed because:
    // 1. Graph edges are prepended (new edges go to head of linked list)
    // 2. So last-added edges represent earliest dependencies
    // 3. Processing in reverse restores the natural dependency order
    for (let i = count - 1; i >= 0; i--) {
      const index = (head + i) & mask;
      const consumer = queue[index]!;
      
      // Clear the scheduled flag before execution
      // This allows the effect to schedule itself again if needed
      consumer._nextScheduled = undefined;
      
      // Execute the effect's flush method
      consumer._flush();
      
      // TODO: Should we check DISPOSED flag here and skip if set?
      // Effects might dispose themselves or each other during execution
    }
    
    // ALGORITHM: Queue Reset
    // Move head to tail position, effectively clearing the queue
    // The actual array slots still contain references, but they'll be
    // overwritten on next use. This avoids the cost of clearing.
    ctx.scheduledHead = ctx.scheduledTail;
    
    // FIXME: Long-running apps might overflow scheduledTail
    // Consider resetting both to 0 when queue is empty
  }

  return {
    scheduleConsumer,
    invalidateConsumer,
    disposeConsumer,
    flushScheduled
  };
}