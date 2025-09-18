import { createBaseContext } from "@lattice/signals/context";
import { createGraphEdges } from "@lattice/signals/helpers/graph-edges";
import { createScheduler } from "@lattice/signals/helpers/scheduler";
import { createPullPropagator } from "@lattice/signals/helpers/pull-propagator";
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

export function createEffectContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();
  const { traverseGraph } = createGraphTraversal();
  const scheduler = createScheduler({ propagate: traverseGraph });

  return {
    ctx,
    graphEdges,
    scheduler,
    propagate: scheduler.propagate,
    pull: createPullPropagator(ctx, graphEdges),
  };
}
