import { Signal } from '@lattice/signals/signal';
import { Effect } from '@lattice/signals/effect';
import { createScheduler } from '@lattice/signals/deps/scheduler';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';
import { compose as createLatticeContext } from '@lattice/lattice';

export const createSvc = () => {
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

  return createLatticeContext(Signal().create(opts), Effect().create(opts))();
};
