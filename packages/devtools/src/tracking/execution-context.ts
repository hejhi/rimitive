/**
 * Execution context tracking for DevTools
 * 
 * This module manages the current execution context (which computed/effect is running)
 * to properly attribute signal reads and dependency tracking.
 */

/**
 * Execution context manager interface
 */
export interface ExecutionContextManager {
  readonly current: string | null;
  push(contextId: string): void;
  pop(): string | null;
  withContext<T>(contextId: string, fn: () => T): T;
  clear(): void;
  getStack(): readonly string[];
  isInContext(): boolean;
}

/**
 * Creates a stack-based execution context manager
 * 
 * Uses a stack to handle nested computations correctly.
 * This is critical for accurate dependency tracking.
 */
export function createExecutionContextManager(): ExecutionContextManager {
  // Private state
  let contextStack: string[] = [];

  return {
    get current(): string | null {
      return contextStack[contextStack.length - 1] || null;
    },

    push(contextId: string): void {
      contextStack.push(contextId);
    },

    pop(): string | null {
      return contextStack.pop() || null;
    },

    withContext<T>(contextId: string, fn: () => T): T {
      this.push(contextId);
      try {
        return fn();
      } finally {
        this.pop();
      }
    },

    clear(): void {
      contextStack = [];
    },

    getStack(): readonly string[] {
      return [...contextStack];
    },

    isInContext(): boolean {
      return contextStack.length > 0;
    },
  };
}

// Global instance for the application
export const executionContext = createExecutionContextManager();