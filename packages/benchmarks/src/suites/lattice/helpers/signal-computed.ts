import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createContext as createLatticeContext } from '@lattice/lattice';

export const createApi = () => {
  const ctx = createBaseContext();
  const { trackDependency, track } = createGraphEdges({ ctx });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { propagate } = createGraphTraversal();

  const opts = {
    ctx,
    trackDependency,
    propagate,
    pullUpdates,
    track,
    shallowPropagate,
  };

  return createLatticeContext(
    Signal().create(opts),
    Computed().create(opts)
  );
}