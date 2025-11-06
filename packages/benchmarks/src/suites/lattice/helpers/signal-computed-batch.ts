import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Batch } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createContext as createLatticeContext } from '@lattice/lattice';

export const createApi = () => {
  const ctx = createBaseContext();
  const { trackDependency, track, detachAll } = createGraphEdges({ ctx });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { withVisitor } = createGraphTraversal();
  const { startBatch, endBatch, withPropagate } = createScheduler({ detachAll });

  const opts = {
    ctx,
    trackDependency,
    propagate: withPropagate(withVisitor),
    pullUpdates,
    startBatch,
    endBatch,
    track,
    shallowPropagate,
  };

  return createLatticeContext(
    Signal().create(opts),
    Computed().create(opts),
    Batch().create(opts)
  );
}