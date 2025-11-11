import { ConsumerNode } from "./types";

// Re-export types for proper type inference
export type { ConsumerNode } from "./types";

export interface SignalsContext {
  consumerScope: ConsumerNode | null;
  trackingVersion: number;
}

export function createBaseContext(): SignalsContext {
  return {
    consumerScope: null,
    trackingVersion: 0,
  };
}