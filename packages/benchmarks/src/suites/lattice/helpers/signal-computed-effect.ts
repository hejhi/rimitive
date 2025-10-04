import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';

export const createApi = () => {
  const ctx = createBaseContext();
  const { traverseGraph, schedule } = createGraphTraversal();
  const graphEdges = createGraphEdges({ ctx });
  const { dispose, propagateSubscribers, propagateScheduled } = createScheduler({
    traverseGraph,
    schedule,
    detachAll: graphEdges.detachAll,
  });
  const { trackDependency, track } = graphEdges;
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track: graphEdges.track });

  return createSignalAPI(
    {
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
    },
    {
      ctx,
      dispose,
      trackDependency,
      track,
      propagateSubscribers,
      propagateScheduled,
      pullUpdates,
      shallowPropagate,
    }
  );
}