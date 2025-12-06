import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { compose as createLatticeContext } from '@lattice/lattice';

export const createSvc = () => {
  const { trackDependency, track, consumer } = createGraphEdges();
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { propagate } = createGraphTraversal();

  const opts = {
    consumer,
    trackDependency,
    propagate,
    pullUpdates,
    track,
    shallowPropagate,
  };

  return createLatticeContext(Signal().create(opts), Computed().create(opts))();
};
