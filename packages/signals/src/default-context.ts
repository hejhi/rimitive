import { createBaseContext, SignalContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
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
  const graphEdges = createGraphEdges();
  const nodeScheduler = createNodeScheduler(baseCtx);
  const pushPropagator = createPushPropagator(nodeScheduler.enqueue);
  const pullPropagator = createPullPropagator();
  
  return {
    ...baseCtx,
    graphEdges,
    pushPropagator,
    pullPropagator,
    nodeScheduler,
  };
}
