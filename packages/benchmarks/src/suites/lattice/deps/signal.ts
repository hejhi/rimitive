import { Signal } from '@lattice/signals/signal';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';
import { compose as createLatticeContext } from '@lattice/lattice';

export const createSvc = () => {
  const { trackDependency, consumer } = createGraphEdges();
  const { propagate } = createGraphTraversal();

  const opts = {
    consumer,
    trackDependency,
    propagate,
  };

  return createLatticeContext(Signal().create(opts))();
};
