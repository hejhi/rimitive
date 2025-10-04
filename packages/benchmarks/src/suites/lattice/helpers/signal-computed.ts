import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';

export const createApi = () => {
  const ctx = createBaseContext();
  const { propagate } = createGraphTraversal();
  const graphEdges = createGraphEdges({ ctx });
  const { trackDependency, track } = graphEdges;
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track: graphEdges.track });

  return createSignalAPI(
    {
      signal: createSignalFactory,
      computed: createComputedFactory,
    },
    {
      ctx,
      trackDependency,
      propagateSubscribers: propagate,
      propagateScheduled: propagate,
      pullUpdates,
      track,
      shallowPropagate,
    }
  );
}