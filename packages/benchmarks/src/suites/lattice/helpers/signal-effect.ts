import { Signal } from '@lattice/signals/signal';
import { Effect } from '@lattice/signals/effect';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createContext as createLatticeContext } from '@lattice/lattice';

export const createApi = () => {
  const { withVisitor } = createGraphTraversal();
  const { detachAll, trackDependency, track, consumer } = createGraphEdges();
  const { dispose, withPropagate } = createScheduler({ detachAll });

  const opts = {
    consumer,
    dispose,
    trackDependency,
    track,
    propagate: withPropagate(withVisitor),
    detachAll,
  };

  return createLatticeContext(Signal().create(opts), Effect().create(opts));
};
