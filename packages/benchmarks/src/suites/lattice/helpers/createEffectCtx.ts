import { createBaseContext } from "@lattice/signals/context";
import { createGraphEdges } from "@lattice/signals/helpers/graph-edges";
import { createNodeScheduler } from "@lattice/signals/helpers/node-scheduler";
import { createPushPropagator } from "@lattice/signals/helpers/push-propagator";

export function createEffectContext(){
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();
  const nodeScheduler = createNodeScheduler();

  return {
    ctx,
    graphEdges,
    push: createPushPropagator({ schedule: nodeScheduler.enqueue }),
    nodeScheduler,
  };
}
