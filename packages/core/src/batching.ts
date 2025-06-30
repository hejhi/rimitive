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
}

/**
 * Creates a batching system for signal updates - scoped per context
 */
export function createBatchingSystem(): BatchingSystem {
  let isBatching = false;
  const batchedUpdates = new Set<() => void>();

  function batch(fn: () => void): void {
    if (isBatching) {
      fn();
      return;
    }

    isBatching = true;
    try {
      fn();
      // Run all batched notifications
      for (const update of batchedUpdates) {
        update();
      }
      batchedUpdates.clear();
    } finally {
      isBatching = false;
    }
  }

  function scheduleUpdate(listener: () => void): void {
    if (isBatching) {
      batchedUpdates.add(listener);
    } else {
      listener();
    }
  }

  return {
    batch,
    scheduleUpdate,
    get batching() {
      return isBatching;
    },
  };
}
