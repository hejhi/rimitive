import { ConsumerNode, ScheduledNode } from "./types";


export interface SignalContext {
  currentConsumer: ConsumerNode | null;
  version: number;
  batchDepth: number;
  scheduledQueue: ScheduledNode[] | null;
  scheduledHead: number;
  scheduledTail: number;
  scheduledMask: number;
}

// Factory to create a new context
export function createContext(): SignalContext {
  return {
    currentConsumer: null,
    version: 0,
    batchDepth: 0,
    scheduledQueue: null, // Lazy allocation
    scheduledHead: 0,
    scheduledTail: 0,
    scheduledMask: 255, // 256 - 1 for fast modulo via bit masking
  };
}
