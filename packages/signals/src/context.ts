import { CONSTANTS } from "./constants";
import { ConsumerNode, ScheduledNode } from "./types";

const { INITIAL_POOL_SIZE } = CONSTANTS;


export interface SignalContext {
  currentConsumer: ConsumerNode | null;
  version: number;
  batchDepth: number;
  scheduledQueue: ScheduledNode[];
  scheduledHead: number;
  scheduledTail: number;
  scheduledMask: number;
  poolSize: number;
  allocations: number;
}

// Factory to create a new context
export function createContext(): SignalContext {
  // Use power of 2 for fast bit masking
  const queueSize = 256;
  
  return {
    currentConsumer: null,
    version: 0,
    batchDepth: 0,
    scheduledQueue: new Array<ScheduledNode>(queueSize),
    scheduledHead: 0,
    scheduledTail: 0,
    scheduledMask: queueSize - 1, // 255 for fast modulo via bit masking
    poolSize: INITIAL_POOL_SIZE,
    allocations: 0,
  };
}
