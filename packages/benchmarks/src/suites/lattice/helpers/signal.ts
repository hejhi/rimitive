import { Signal } from '@lattice/signals/signal';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createContext as createLatticeContext } from '@lattice/lattice';

export const createApi = () => {
  const ctx = createBaseContext();
  const { trackDependency } = createGraphEdges({ ctx });
  const { propagate } = createGraphTraversal();

  const opts = {
    ctx,
    trackDependency,
    propagate,
  };

  return createLatticeContext(
    Signal().create(opts)
  );
};
