import { ConsumerNode, Dependency } from "./types";

// Re-export types for proper type inference
export type { ConsumerNode, Dependency } from "./types";

export interface GlobalContext {
  consumerScope: ConsumerNode | null;
  trackingVersion: number;

  // Temporary collection list for scheduled effects during propagation
  scheduledToFlush: Dependency | undefined;
}

export function createBaseContext(): GlobalContext {
  return {
    consumerScope: null,
    trackingVersion: 0,
    scheduledToFlush: undefined,
  };
}