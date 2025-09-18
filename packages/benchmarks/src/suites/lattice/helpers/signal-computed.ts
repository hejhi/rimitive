import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';

const { propagate } = createGraphTraversal();
const graphEdges = createGraphEdges();
const { trackDependency } = graphEdges;
const ctx = createBaseContext();
const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });

export const createApi = () => createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
  },
  {
    ctx,
    trackDependency,
    propagate,
    pullUpdates,
  }
);
