/**
 * @fileoverview Update batching system for efficient signal updates
 *
 * Batches multiple signal updates to prevent redundant recomputations
 * and improve performance in reactive systems.
 */

export interface BatchingSystem {
  batch(fn: () => void): void;
  scheduleUpdate(listener: () => void): void;
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
  let batchedUpdates = new Set<() => void>();

  function runUpdates() {
    if (!batchedUpdates.size) return;

    const updates = batchedUpdates;
    batchedUpdates = new Set<() => void>();

    for (const update of updates) {
      update();
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
    if (!isBatching) runUpdates();
  }

  return {
    batch,
    scheduleUpdate,
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
