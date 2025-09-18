import { createBaseContext } from "@lattice/signals/context";
import { createGraphEdges } from "@lattice/signals/helpers/graph-edges";
import { createGraphTraversal } from "@lattice/signals/helpers/graph-traversal";
import { createPullPropagator } from "@lattice/signals/helpers/pull-propagator";

export function createComputedContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();
  const { propagate } = createGraphTraversal();

  return {
    ctx,
    graphEdges,
    propagate,
    pull: createPullPropagator(ctx, graphEdges),
  };
}
