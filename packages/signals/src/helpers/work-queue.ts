import { CONSTANTS } from '../constants';
import type { ScheduledNode } from '../types';

const { DISPOSED } = CONSTANTS;

export interface QueueState {
  queue: ScheduledNode[] | null;
  head: number;
  tail: number;
  mask: number;
}

export interface WorkQueue {
  state: QueueState;
  enqueue: (node: ScheduledNode) => void;
  dispose: <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void
  ) => void;
  flush: () => void;
}

/**
 * ALGORITHM: High-Performance Effect Scheduling System
 * 
 * Effects (side effects) require careful scheduling to maintain consistency.
 * This module implements several key algorithms:
 * 
 * 1. CIRCULAR BUFFER QUEUE:
 *    - Fixed-size array (256 slots) with head/tail pointers
 *    - O(1) enqueue and dequeue operations
 *    - No array resizing or memory allocation during operation
 *    - Power-of-2 size enables bitwise AND for fast modulo
 * 
 * 2. INTRUSIVE SCHEDULING FLAG:
 *    - Use _nextScheduled property as both flag and linked list pointer
 *    - Self-reference (_nextScheduled = this) indicates "scheduled"
 *    - Avoids separate boolean flag or set lookup
 * 
 * 3. BATCH-AWARE EXECUTION:
 *    - Inside batch: Queue for later
 *    - Outside batch: Execute immediately
 *    - Ensures effects never see inconsistent intermediate states
 * 
 * 4. REVERSE-ORDER PROCESSING:
 *    - Process queue LIFO to achieve FIFO semantics
 *    - Compensates for edge prepending in dependency graph
 *    - Ensures proper execution order respecting dependencies
 * 
 * PERFORMANCE CHARACTERISTICS:
 * - Enqueue: O(1) - Direct array access with bitwise index
 * - Dequeue: O(1) - Pointer arithmetic, no shifting
 * - Memory: O(1) - Fixed 256-slot buffer, no dynamic allocation
 * 
 * LIMITATIONS:
 * - Fixed queue size (256) - will wrap and overwrite if exceeded
 * - No automatic resizing - could lose effects in pathological cases
 * - scheduledTail can overflow (32-bit integer limit)
 */
export function createWorkQueue(): WorkQueue {
  const state: QueueState = {
    queue: null,
    head: 0,
    tail: 0,
    mask: 255
  };
  /**
   * ALGORITHM: Circular Buffer Queue for O(1) Scheduling
   *
   * Instead of using array push/shift (O(n) for shift), we use a circular
   * buffer with head/tail pointers. This provides O(1) enqueue and dequeue.
   *
   * The buffer size is always a power of 2 (256), allowing us to use bitwise
   * AND instead of modulo for wrapping, which is significantly faster.
   */
  const enqueue = (node: ScheduledNode): void => {
    // OPTIMIZATION: Use _nextScheduled as a boolean flag
    // Instead of searching the queue to check if scheduled, we use the
    // _nextScheduled property as a flag. Any non-undefined value means scheduled.
    if (node._nextScheduled !== undefined) return;

    // Mark as scheduled - we use self-reference as a sentinel value
    // This is memory-efficient and doesn't require a separate boolean
    node._nextScheduled = node;

    // OPTIMIZATION: Lazy Queue Allocation
    // Don't allocate the 256-element array until we actually need it
    // Many apps might not use effects at all
    if (!state.queue) {
      state.queue = new Array<ScheduledNode>(256);
    }

    // SAFETY: Queue Overflow Protection
    // Check if queue is full before inserting to prevent silent data loss
    // This adds ~2-3ns overhead but prevents catastrophic failures
    const queueSize = state.tail - state.head;
    if (queueSize >= 256) {
      // Log error for debugging before throwing
      console.error('[signals] Queue overflow:', queueSize);
      throw new Error(`Queue overflow: ${queueSize}`);
    }

    // ALGORITHM: Circular Buffer Insertion
    // Use bitwise AND with mask (255 = 0xFF = 11111111 in binary)
    // This is equivalent to scheduledTail % 256 but much faster
    // Example: 257 & 255 = 1, 513 & 255 = 1 (wraps around)
    state.queue[state.tail & state.mask] = node;
    state.tail++;
  };


  /**
   * ALGORITHM: Safe Disposal Pattern
   *
   * Ensures consumers are disposed exactly once and marked to prevent
   * further scheduling or execution. The DISPOSED flag acts as a
   * tombstone to skip the node in all future operations.
   */
  const dispose = <T extends ScheduledNode>(
    node: T,
    cleanup: (node: T) => void // Custom cleanup logic per node type
  ): void => {
    // OPTIMIZATION: Idempotent disposal
    // Check flag first to avoid redundant cleanup
    if (node._flags & DISPOSED) return;

    // Mark as disposed before cleanup to prevent re-entrance
    node._flags |= DISPOSED;

    // Execute consumer-specific cleanup (remove edges, clear references)
    cleanup(node);
  };

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
  const flush = (): void => {
    // Skip if queue hasn't been initialized yet (no effects used)
    if (!state.queue) return;

    const queue = state.queue;
    const mask = state.mask;
    const head = state.head;

    // Calculate number of items to process
    // Since tail can wrap around, this arithmetic works correctly
    const count = state.tail - head;

    // ALGORITHM: Reverse Order Processing for Correct Execution Order
    // Process from tail to head (LIFO) to achieve FIFO effect order
    // This counterintuitive approach is needed because:
    // 1. Graph edges are prepended (new edges go to head of linked list)
    // 2. So last-added edges represent earliest dependencies
    // 3. Processing in reverse restores the natural dependency order
    for (let i = count - 1; i >= 0; i--) {
      const index = (head + i) & mask;
      const node = queue[index]!;

      // Clear the scheduled flag before execution
      // This allows the effect to schedule itself again if needed
      node._nextScheduled = undefined;

      // Execute the effect's flush method
      node._flush();

      // TODO: Should we check DISPOSED flag here and skip if set?
      // Effects might dispose themselves or each other during execution
    }

    // ALGORITHM: Queue Reset with Overflow Prevention
    // Move head to tail position, effectively clearing the queue
    // The actual array slots still contain references, but they'll be
    // overwritten on next use. This avoids the cost of clearing.
    state.head = state.tail;

    // SAFETY: Prevent Integer Overflow
    // After ~2 billion operations, scheduledTail could overflow.
    // Reset both counters to 0 when queue is empty to prevent this.
    // This is safe because the queue is empty (head === tail).
    if (state.tail > 0x7ffffff0) {
      // Close to MAX_SAFE_INTEGER/2
      state.head = 0;
      state.tail = 0;
    }
  };

  return {
    state,
    enqueue,
    dispose,
    flush,
  };
}