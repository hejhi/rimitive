import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Batch } from '@lattice/signals/batch';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { compose as createLatticeContext } from '@lattice/lattice';

export const createApi = () => {
  const { trackDependency, track, detachAll, consumer } = createGraphEdges();
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { withVisitor } = createGraphTraversal();
  const { startBatch, endBatch, withPropagate } = createScheduler({
    detachAll,
  });

  const opts = {
    trackDependency,
    propagate: withPropagate(withVisitor),
    pullUpdates,
    startBatch,
    endBatch,
    track,
    shallowPropagate,
    consumer,
  };

  return createLatticeContext(
    Signal().create(opts),
    Computed().create(opts),
    Batch().create(opts)
  );
};
