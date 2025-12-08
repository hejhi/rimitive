import { createSignalFactory } from '@lattice/signals/signal';
import { createEffectFactory } from '@lattice/signals/effect';
import { createScheduler } from '@lattice/signals/deps/scheduler';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';

export const createSvc = () => {
  const graphEdges = createGraphEdges();
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const propagate = scheduler.withPropagate(withVisitor);

  const signal = createSignalFactory({
    graphEdges,
    propagate,
  });

  const effect = createEffectFactory({
    track: graphEdges.track,
    dispose: scheduler.dispose,
  });

  return { signal, effect };
};
