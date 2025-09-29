import { ConsumerNode, FromNode } from "./types";

// Re-export types for proper type inference
export type { ConsumerNode, FromNode } from "./types";

/**
 * ALGORITHM: Context-Based State Isolation
 *
 * GlobalContext encapsulates all mutable global state for the reactive system.
 * This design enables:
 * 1. Thread safety: Each thread/request can have its own context
 * 2. SSR support: Isolated contexts prevent state leakage between requests
 * 3. Testing: Easy to reset state between tests
 * 4. Concurrent rendering: React concurrent features get isolated contexts
 *
 * The context pattern is inspired by React's Context API and Zone.js.
 */
export interface GlobalContext {
  // ALGORITHM: Implicit Dependency Tracking
  // When a computed/effect reads a signal, we need to know WHO is reading.
  // This field acts as an implicit parameter threaded through all reads.
  // Similar to React's Fiber tracking or Vue's targetStack.
  currentConsumer: ConsumerNode | null;

  // ALGORITHM: Value-Based Change Detection
  // During pull phase, we store the versions that triggered recomputation.
  // When tracking new dependencies, we use these triggering versions
  // instead of current versions to avoid missing changes.
  triggeringVersions?: Map<FromNode, number>;
}

// PATTERN: Factory Function
// Creates a new isolated context with default values.
// Using a factory instead of a class avoids prototype overhead.
// This is the base context without helpers - use createDefaultContext for a complete context
export function createBaseContext(): GlobalContext {
  return {
    currentConsumer: null,
    queueHead: undefined,
    queueTail: undefined,
  } as GlobalContext; // Cast since helpers will be added by createDefaultContext
}