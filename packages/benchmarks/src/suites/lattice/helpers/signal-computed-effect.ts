import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { compose as createLatticeContext } from '@lattice/lattice';

export const createApi = () => {
  const { trackDependency, track, detachAll, consumer } = createGraphEdges();
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { withVisitor } = createGraphTraversal();
  const { dispose, withPropagate } = createScheduler({ detachAll });

  const opts = {
    consumer,
    dispose,
    trackDependency,
    track,
    propagate: withPropagate(withVisitor),
    pullUpdates,
    shallowPropagate,
  };

  return createLatticeContext(
    Signal().create(opts),
    Computed().create(opts),
    Effect().create(opts)
  );
};
