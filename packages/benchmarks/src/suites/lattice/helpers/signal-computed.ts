import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createApi as createLatticeApi } from '@lattice/lattice';

export const createApi = () => {
  const ctx = createBaseContext();
  const { trackDependency, track } = createGraphEdges({ ctx });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { traverseGraph } = createGraphTraversal();

  return createLatticeApi(
    {
      signal: createSignalFactory,
      computed: createComputedFactory,
    },
    {
      ctx,
      trackDependency,
      propagate: traverseGraph,
      pullUpdates,
      track,
      shallowPropagate,
    }
  );
}