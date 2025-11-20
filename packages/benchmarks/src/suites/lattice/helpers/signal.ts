import { Signal } from '@lattice/signals/signal';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createContext as createLatticeContext } from '@lattice/lattice';

export const createApi = () => {
  const { trackDependency, consumer } = createGraphEdges();
  const { propagate } = createGraphTraversal();

  const opts = {
    consumer,
    trackDependency,
    propagate,
  };

  return createLatticeContext(Signal().create(opts));
};
