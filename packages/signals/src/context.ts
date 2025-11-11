import { ConsumerNode } from "./types";

// Re-export types for proper type inference
export type { ConsumerNode } from "./types";

/**
 * Signals context - provides ambient tracking scope for reactive dependency tracking.
 *
 * Note: Version tracking is managed internally by graph-edges as a closure variable,
 * not exposed on the context.
 */
export interface SignalsContext {
  consumerScope: ConsumerNode | null;
}

export function createBaseContext(): SignalsContext {
  return {
    consumerScope: null,
  };
}