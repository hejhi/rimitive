import { createSignalFactory } from '@lattice/signals/signal';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';
import { createScheduler } from '@lattice/signals/deps/scheduler';

export const createSvc = () => {
  const graphEdges = createGraphEdges();
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const propagate = scheduler.withPropagate(withVisitor);

  const signal = createSignalFactory({
    graphEdges,
    propagate,
  });

  return { signal };
};
