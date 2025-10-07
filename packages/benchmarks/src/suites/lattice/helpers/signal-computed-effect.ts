import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createApi as createLatticeApi } from '@lattice/lattice';

export const createApi = () => {
  const ctx = createBaseContext();
  const { trackDependency, track, detachAll } = createGraphEdges({ ctx });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });
  const { withVisitor } = createGraphTraversal();
  const { dispose, propagate } = createScheduler({
    traverseGraph: withVisitor,
    detachAll,
  });

  return createLatticeApi(
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
      propagate,
      pullUpdates,
      shallowPropagate,
    }
  );
}