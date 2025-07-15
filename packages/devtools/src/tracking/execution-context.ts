/**
 * Execution context tracking for DevTools
 * 
 * This module manages the current execution context (which computed/effect is running)
 * to properly attribute signal reads and dependency tracking.
 */

/**
 * Stack-based execution context manager
 * 
 * Uses a stack to handle nested computations correctly.
 * This is critical for accurate dependency tracking.
 */
export class ExecutionContextManager {
  private contextStack: string[] = [];

  /**
   * Get the current execution context
   */
  get current(): string | null {
    return this.contextStack[this.contextStack.length - 1] || null;
  }

  /**
   * Push a new execution context
   */
  push(contextId: string): void {
    this.contextStack.push(contextId);
  }

  /**
   * Pop the current execution context
   */
  pop(): string | null {
    return this.contextStack.pop() || null;
  }

  /**
   * Execute a function within a specific context
   */
  withContext<T>(contextId: string, fn: () => T): T {
    this.push(contextId);
    try {
      return fn();
    } finally {
      this.pop();
    }
  }

  /**
   * Clear all contexts (useful for cleanup)
   */
  clear(): void {
    this.contextStack = [];
  }

  /**
   * Get the full context stack (for debugging)
   */
  getStack(): readonly string[] {
    return [...this.contextStack];
  }

  /**
   * Check if we're in any execution context
   */
  isInContext(): boolean {
    return this.contextStack.length > 0;
  }
}

// Global instance for the application
export const executionContext = new ExecutionContextManager();