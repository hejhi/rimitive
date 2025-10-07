import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createApi as createLatticeApi } from '@lattice/lattice';

export const createApi = () => {
  const ctx = createBaseContext();
  const { trackDependency, track, detachAll } = createGraphEdges({ ctx });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { traverseGraph } = createGraphTraversal();
  const { startBatch, endBatch, propagate } = createScheduler({
    traverseGraph,
    detachAll
  });

  return createLatticeApi(
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
      track,
      shallowPropagate,
    }
  );
}