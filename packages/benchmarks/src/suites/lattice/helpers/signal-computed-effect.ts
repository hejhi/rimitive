import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';

const { traverseGraph } = createGraphTraversal();
const { dispose, propagate } = createScheduler({ propagate: traverseGraph });
const graphEdges = createGraphEdges();
const { trackDependency, track, detachAll } = graphEdges;
const ctx = createBaseContext();
const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });

export const createApi = () => createSignalAPI(
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
    detachAll,
  }
);
