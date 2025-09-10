import { GlobalContext } from "@lattice/signals/api";
import { BatchContext } from "@lattice/signals/batch";
import { ComputedContext } from "@lattice/signals/computed";
import { createBaseContext } from "@lattice/signals/context";
import { EffectContext } from "@lattice/signals/effect";
import { createGraphEdges } from "@lattice/signals/helpers/graph-edges";
import { createNodeScheduler, NodeScheduler } from "@lattice/signals/helpers/node-scheduler";
import { createPullPropagator } from "@lattice/signals/helpers/pull-propagator";
import { createPushPropagator } from "@lattice/signals/helpers/push-propagator";
import { SignalContext } from "@lattice/signals/signal";


export function createComputedContext(): GlobalContext &
  SignalContext &
  BatchContext &
  EffectContext &
  ComputedContext {
  const baseCtx = createBaseContext();

  // Create helpers with their dependencies
  const graphEdges = createGraphEdges();
  const pushPropagator = createPushPropagator();

  // Extend baseCtx in place to ensure nodeScheduler uses the same context object
  const ctx = {
    ...baseCtx,
    graphEdges,
    pushPropagator,
    pullPropagator: null as unknown as ReturnType<typeof createPullPropagator>, // Will be set below
    nodeScheduler: null as unknown as NodeScheduler, // Will be set below
  };

  // Now create pullPropagator with context
  const pullPropagator = createPullPropagator(ctx);
  ctx.pullPropagator = pullPropagator;

  // Now create nodeScheduler with the same ctx object
  const nodeScheduler = createNodeScheduler(ctx);

  ctx.nodeScheduler = nodeScheduler;

  return ctx;
}
