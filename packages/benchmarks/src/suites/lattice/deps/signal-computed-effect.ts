import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createScheduler } from '@lattice/signals/deps/scheduler';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';
import { createPullPropagator } from '@lattice/signals/deps/pull-propagator';

export const createSvc = () => {
  const graphEdges = createGraphEdges();
  const { pullUpdates, shallowPropagate } = createPullPropagator({
    track: graphEdges.track,
  });
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const propagate = scheduler.withPropagate(withVisitor);

  const signal = createSignalFactory({
    graphEdges,
    propagate,
  });

  const computed = createComputedFactory({
    consumer: graphEdges.consumer,
    trackDependency: graphEdges.trackDependency,
    pullUpdates,
    track: graphEdges.track,
    shallowPropagate,
  });

  const effect = createEffectFactory({
    track: graphEdges.track,
    dispose: scheduler.dispose,
  });

  return { signal, computed, effect };
};
