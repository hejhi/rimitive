import { CONSTANTS } from "./constants";
import { Consumer, Edge, ScheduledConsumer } from "./types";

const { INITIAL_POOL_SIZE } = CONSTANTS;


export interface SignalContext {
  currentConsumer: Consumer | null;
  version: number;
  batchDepth: number;
  scheduled: ScheduledConsumer | null;
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
  
  return {
    currentConsumer: null,
    version: 0,
    batchDepth: 0,
    scheduled: null,
    nodePool: nodePool,
    poolSize: INITIAL_POOL_SIZE,
    allocations: 0,
  };
}
