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
 * State machine states for the batching system
 */
enum BatchState {
  /** Normal operation - updates run immediately */
  IDLE = 'IDLE',
  /** Collecting updates to run together after batch completes */
  BATCHING = 'BATCHING',
  /** Inside a notification callback - prevents re-entrant reads */
  NOTIFYING = 'NOTIFYING',
  /** Processing queued updates */
  PROCESSING = 'PROCESSING',
}

/**
 * Creates a batching system for signal updates - scoped per context
 */
export function createBatchingSystem(): BatchingSystem {
  let state = BatchState.IDLE;
  let batchedUpdates = new Set<() => void>();
  
  // Stack to handle nested state transitions
  const stateStack: BatchState[] = [];

  function runUpdates() {
    if (!batchedUpdates.size) return;
    
    // Can't process updates if already processing
    if (state === BatchState.PROCESSING) return;
    
    const previousState = state;
    const wasInBatch = state === BatchState.BATCHING;
    
    // Save state and transition to processing
    if (wasInBatch) {
      stateStack.push(state);
    }
    state = BatchState.PROCESSING;

    try {
      // Process all updates in a loop until there are no more
      while (batchedUpdates.size) {
        const updates = batchedUpdates;
        batchedUpdates = new Set<() => void>();

        for (const update of updates) {
          update();
        }

        // If we were originally in a batch, only do one iteration
        if (wasInBatch) break;
      }
    } finally {
      // Restore previous state
      if (wasInBatch && stateStack.length > 0) {
        state = stateStack.pop()!;
      } else {
        state = previousState;
      }
    }
  }

  function batch(fn: () => void): void {
    if (state === BatchState.BATCHING) {
      // Already batching, just run the function
      fn();
      return;
    }

    const previousState = state;
    state = BatchState.BATCHING;

    try {
      fn();
      runUpdates();
    } finally {
      state = previousState;

      // Process any remaining updates after batch completes
      if (batchedUpdates.size && state === BatchState.IDLE) {
        runUpdates();
      }
    }
  }

  function scheduleUpdate(listener: () => void): void {
    // Defer updates unless we're in IDLE state
    if (state !== BatchState.IDLE) {
      batchedUpdates.add(listener);
      return;
    }

    listener();
  }

  function enterNotification(): void {
    stateStack.push(state);
    state = BatchState.NOTIFYING;
  }

  function exitNotification(): void {
    const previousState = stateStack.pop();
    if (previousState !== undefined) {
      state = previousState;
    } else {
      state = BatchState.IDLE;
    }

    // Process any deferred updates from re-entrant subscriptions
    // Only if we're back in IDLE state (prevents recursion during processing)
    if (state === BatchState.IDLE && batchedUpdates.size) {
      runUpdates();
    }
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
      return state === BatchState.BATCHING;
    },
    get notifying() {
      return state === BatchState.NOTIFYING;
    },
  };
}
