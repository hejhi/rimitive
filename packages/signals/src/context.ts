import { CONSTANTS } from "./constants";
import { ConsumerNode, Edge, ScheduledNode } from "./types";

const { INITIAL_POOL_SIZE } = CONSTANTS;


export interface SignalContext {
  currentConsumer: ConsumerNode | null;
  version: number;
  batchDepth: number;
  scheduledQueue: ScheduledNode[];
  scheduledHead: number;
  scheduledTail: number;
  scheduledMask: number;
  nodePool: Edge[];
  poolSize: number;
  allocations: number;
}

// Factory to create a new context
export function createContext(): SignalContext {
  const nodePool = new Array(INITIAL_POOL_SIZE) as Edge[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    nodePool[i] = {} as Edge;
  }
  
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
    nodePool: nodePool,
    poolSize: INITIAL_POOL_SIZE,
    allocations: 0,
  };
}
