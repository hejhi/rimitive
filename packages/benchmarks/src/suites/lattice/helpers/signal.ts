import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

export const createApi = () => {
  const ctx = createBaseContext();
  const { trackDependency } = createGraphEdges({ ctx });
  const { traverseGraph } = createGraphTraversal();

  return createSignalAPI(
    { signal: createSignalFactory },
    {
      ctx,
      trackDependency,
      propagate: traverseGraph,
    }
  );
};
