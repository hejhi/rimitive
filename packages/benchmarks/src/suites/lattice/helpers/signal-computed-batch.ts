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
  const ctx = createBaseContext();
  const { trackDependency, track, detachAll } = createGraphEdges({ ctx });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { traverseGraph } = createGraphTraversal();
  const { startBatch, endBatch, propagateSubscribers, propagateScheduled } = createScheduler({
    traverseGraph,
    detachAll
  });

  return createSignalAPI(
    {
      signal: createSignalFactory,
      computed: createComputedFactory,
      batch: createBatchFactory,
    },
    {
      ctx,
      trackDependency,
      propagateSubscribers,
      propagateScheduled,
      pullUpdates,
      startBatch,
      endBatch,
      track,
      shallowPropagate
    }
  );
}