import { createBaseContext, GlobalContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
import { createPushPropagator } from './helpers/push-propagator';
import { createPullPropagator } from './helpers/pull-propagator';
import { createNodeScheduler, type NodeScheduler } from './helpers/node-scheduler';
import { SignalContext } from './signal';
import { ComputedContext } from './computed';
import { EffectContext } from './effect';

export function createDefaultContext(): GlobalContext & SignalContext & EffectContext & ComputedContext {
  const baseCtx = createBaseContext();

  // Create helpers with their dependencies
  const graphEdges = createGraphEdges();
  const pushPropagator = createPushPropagator();
  
  // Extend baseCtx in place to ensure nodeScheduler uses the same context object
  const ctx = Object.assign(baseCtx, {
    graphEdges,
    pushPropagator,
    pullPropagator: null as unknown as ReturnType<typeof createPullPropagator>, // Will be set below
    nodeScheduler: null as unknown as NodeScheduler, // Will be set below
  });
  
  // Now create pullPropagator with context
  const pullPropagator = createPullPropagator(ctx);
  ctx.pullPropagator = pullPropagator;
  
  // Now create nodeScheduler with the same ctx object
  const nodeScheduler = createNodeScheduler(ctx);
  
  ctx.nodeScheduler = nodeScheduler;
  
  return ctx;
}