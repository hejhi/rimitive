import { createBaseContext } from "@lattice/signals/context";
import { createGraphEdges } from "@lattice/signals/helpers/graph-edges";
import { createScheduler } from "@lattice/signals/helpers/scheduler";
import { createPullPropagator } from "@lattice/signals/helpers/pull-propagator";

export function createEffectContext(){
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();
  const scheduler = createScheduler();

  return {
    ctx,
    graphEdges,
    scheduler,
    pull: createPullPropagator(ctx, graphEdges),
  };
}
