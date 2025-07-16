// Execution state tracking for log processing

export interface ExecutionState {
  activeEffects: Map<string, { startTime: number; triggeredBy: string[] }>;
  activeComputeds: Map<
    string,
    { startTime: number; triggeredBy: string[]; oldValue?: unknown }
  >;
  recentWrites: Map<string, { timestamp: number; nodeId: string }>;
  currentLevel: number;
}

export function createExecutionState(): ExecutionState {
  return {
    activeEffects: new Map(),
    activeComputeds: new Map(),
    recentWrites: new Map(),
    currentLevel: 0,
  };
}

export function trackRecentWrite(
  state: ExecutionState,
  nodeId: string,
  timestamp: number
) {
  state.recentWrites.set(nodeId, { timestamp, nodeId });
}

export function startComputed(
  state: ExecutionState,
  id: string,
  triggeredBy: string[],
  oldValue?: unknown,
  timestamp = Date.now()
) {
  state.activeComputeds.set(id, {
    startTime: timestamp,
    triggeredBy,
    oldValue,
  });
  state.currentLevel++;
}

export function endComputed(state: ExecutionState, id: string) {
  const computed = state.activeComputeds.get(id);
  if (computed) {
    state.activeComputeds.delete(id);
    state.currentLevel = Math.max(0, state.currentLevel - 1);
  }
  return computed;
}

export function startEffect(
  state: ExecutionState,
  id: string,
  triggeredBy: string[],
  timestamp = Date.now()
) {
  state.activeEffects.set(id, {
    startTime: timestamp,
    triggeredBy,
  });
  state.currentLevel++;
}

export function endEffect(state: ExecutionState, id: string) {
  const effect = state.activeEffects.get(id);
  if (effect) {
    state.activeEffects.delete(id);
    state.currentLevel = Math.max(0, state.currentLevel - 1);
  }
  return effect;
}

export function findRecentTrigger(
  state: ExecutionState,
  nodeId: string,
  dependencies: Set<string>,
  timeWindow = 100
): string | null {
  const now = Date.now();
  let mostRecentWrite: { nodeId: string; timestamp: number } | undefined;

  dependencies.forEach((depId) => {
    const write = state.recentWrites.get(depId);
    if (write && now - write.timestamp < timeWindow) {
      if (!mostRecentWrite || write.timestamp > mostRecentWrite.timestamp) {
        mostRecentWrite = write;
      }
    }
  });

  return mostRecentWrite ? mostRecentWrite.nodeId : null;
}