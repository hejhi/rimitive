import { createBaseContext, SignalContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
import { createNodeState } from './helpers/node-state';
import { createPushPropagator } from './helpers/push-propagator';
import { createPullPropagator } from './helpers/pull-propagator';
import { createNodeScheduler } from './helpers/node-scheduler';

/**
 * Creates the default extended context with all required services.
 * Users can use this as a starting point or create their own by composing
 * different helpers or replacing specific ones.
 */
export function createDefaultContext(): SignalContext {
  const baseCtx = createBaseContext();
  
  // Create helpers with their dependencies
  const nodeState = createNodeState();
  const graphEdges = createGraphEdges(nodeState.setStatus);
  const pushPropagator = createPushPropagator(nodeState);
  const pullPropagator = createPullPropagator(nodeState);
  const nodeScheduler = createNodeScheduler(baseCtx);
  
  return {
    ...baseCtx,
    nodeState,
    graphEdges,
    pushPropagator,
    pullPropagator,
    nodeScheduler,
  };
}
