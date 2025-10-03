import { ConsumerNode } from "./types";

// Re-export types for proper type inference
export type { ConsumerNode } from "./types";

export interface GlobalContext {
  consumerScope: ConsumerNode | null;
  trackingVersion: number;
}

export function createBaseContext(): GlobalContext {
  return {
    consumerScope: null,
    trackingVersion: 0,
  };
}