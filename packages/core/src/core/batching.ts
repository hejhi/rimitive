/**
 * @fileoverview Update batching system for efficient signal updates
 *
 * Batches multiple signal updates to prevent redundant recomputations
 * and improve performance in reactive systems.
 */

export interface BatchingSystem {
  batch(fn: () => void): void;
  scheduleUpdate(listener: () => void): void;
  notify(fn: () => void): void;
  readonly batching: boolean;
  readonly notifying: boolean;
  enterNotification(): void;
  exitNotification(): void;
}

/**
 * Creates a batching system for signal updates - scoped per context
 */
export function createBatchingSystem(): BatchingSystem {
  let isBatching = false;
  let isNotifying = false;
  let isRunningUpdates = false;
  let batchedUpdates = new Set<() => void>();

  function runUpdates() {
    if (!batchedUpdates.size) return;

    const wasBatching = isBatching;

    // Process all updates in a loop until there are no more
    while (batchedUpdates.size) {
      isRunningUpdates = true;
      const updates = batchedUpdates;
      batchedUpdates = new Set<() => void>();

      // Run updates with batching context cleared
      const wasNotifying = isNotifying;
      isBatching = false;
      isNotifying = false;

      try {
        for (const update of updates) {
          update();
        }
      } finally {
        isBatching = wasBatching;
        isNotifying = wasNotifying;
        isRunningUpdates = false;
      }

      // If we were originally in a batch, stop processing and let the batch handle remaining updates
      if (wasBatching) break;
    }
  }

  function batch(fn: () => void): void {
    if (isBatching) {
      fn();
      return;
    }

    isBatching = true;

    try {
      fn();
      runUpdates();
    } finally {
      isBatching = false;

      // Process any remaining updates after batch completes
      if (batchedUpdates.size) runUpdates();
    }
  }

  function scheduleUpdate(listener: () => void): void {
    // If we're batching OR notifying, defer the update
    if (isBatching || isNotifying) {
      batchedUpdates.add(listener);
      return;
    }

    listener();
  }

  function enterNotification(): void {
    isNotifying = true;
  }

  function exitNotification(): void {
    isNotifying = false;

    // Process any deferred updates from re-entrant subscriptions
    // But not if we're already running updates (prevents recursion)
    if (!isBatching && !isRunningUpdates) runUpdates();
  }

  /**
   * Wraps a notification callback to prevent re-entrant reads during updates.
   * This prevents infinite loops when reactive values notify their listeners.
   */
  function notify(fn: () => void): void {
    enterNotification();
    try {
      fn();
    } finally {
      exitNotification();
    }
  }

  return {
    batch,
    scheduleUpdate,
    notify,
    enterNotification,
    exitNotification,
    get batching() {
      return isBatching;
    },
    get notifying() {
      return isNotifying;
    },
  };
}
