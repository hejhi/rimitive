import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { createScheduler } from '@lattice/signals/deps/scheduler';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';
import { createPullPropagator } from '@lattice/signals/deps/pull-propagator';
import { compose as createLatticeContext } from '@lattice/lattice';

export const createSvc = () => {
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
  )();
};
