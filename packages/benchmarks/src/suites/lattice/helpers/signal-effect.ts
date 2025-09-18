import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

export const createApi = () => {
  const { traverseGraph } = createGraphTraversal();
  const { dispose, propagate } = createScheduler({ propagate: traverseGraph });
  const graphEdges = createGraphEdges();
  const { trackDependency, track, detachAll } = graphEdges;
  const ctx = createBaseContext();

  return createSignalAPI(
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
