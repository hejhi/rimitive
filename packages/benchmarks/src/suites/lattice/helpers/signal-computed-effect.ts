import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createContext as createLatticeContext } from '@lattice/lattice';

export const createApi = () => {
  const ctx = createBaseContext();
  const { trackDependency, track, detachAll } = createGraphEdges({ ctx });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { withVisitor } = createGraphTraversal();
  const { dispose, withPropagate } = createScheduler({ detachAll });

  const opts = {
    ctx,
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
}