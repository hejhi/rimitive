import { GlobalContext } from "@lattice/signals/api";
import { createBaseContext } from "@lattice/signals/context";
import { EffectContext } from "@lattice/signals/effect";
import { createGraphEdges } from "@lattice/signals/helpers/graph-edges";
import { createNodeScheduler, NodeScheduler } from "@lattice/signals/helpers/node-scheduler";
import { createPushPropagator } from "@lattice/signals/helpers/push-propagator";
import { SignalContext } from "@lattice/signals/signal";


export function createEffectContext(): GlobalContext &
  SignalContext &
  EffectContext {
  const baseCtx = createBaseContext();

  // Create helpers with their dependencies
  const graphEdges = createGraphEdges();
  const pushPropagator = createPushPropagator();

  const ctx = {
    ...baseCtx,
    graphEdges,
    pushPropagator,
    nodeScheduler: null as unknown as NodeScheduler, // Will be set below
  };

  // Now create nodeScheduler with the same ctx object
  const nodeScheduler = createNodeScheduler(ctx);

  ctx.nodeScheduler = nodeScheduler;

  return ctx;
}
