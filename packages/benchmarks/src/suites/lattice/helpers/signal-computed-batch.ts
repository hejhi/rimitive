import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';

import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createScheduler } from '@lattice/signals/helpers/scheduler';

export const createApi = () => {
  const { traverseGraph } = createGraphTraversal();
  const graphEdges = createGraphEdges();
  const { trackDependency } = graphEdges;
  const ctx = createBaseContext();
  const { startBatch, endBatch, propagate } = createScheduler({
    propagate: traverseGraph,
    detachAll: graphEdges.detachAll
  });
  const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });

  return createSignalAPI(
    {
      signal: createSignalFactory,
      computed: createComputedFactory,
      batch: createBatchFactory,
    },
    {
      ctx,
      trackDependency,
      propagate,
      pullUpdates,
      startBatch,
      endBatch,
    }
  );
}