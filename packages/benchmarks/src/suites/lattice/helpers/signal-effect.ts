import { createSignalFactory } from '@lattice/signals/signal';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createApi as createLatticeApi } from '@lattice/lattice';

export const createApi = () => {
  const ctx = createBaseContext();
  const { traverseGraph } = createGraphTraversal();
  const { detachAll, trackDependency, track } = createGraphEdges({ ctx });
  const { dispose, propagate } = createScheduler({
    traverseGraph,
    detachAll,
  });

  return createLatticeApi(
    {
      signal: createSignalFactory,
      effect: createEffectFactory,
    },
    {
      ctx,
      dispose,
      trackDependency,
      track,
      propagate,
      detachAll,
    }
  );
}
